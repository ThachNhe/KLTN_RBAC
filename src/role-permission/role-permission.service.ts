import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import * as unzipper from 'unzipper'
import * as xml2js from 'xml2js'

@Injectable()
export class RolePermissionService {
  private rules: any[] = []
  private permissions: any[] = []

  async checkProjectPermissions(xmlFileData: string, nestJsZipBuffer: Buffer) {
    // Analyze XML file to get modules
    const modules = await this.parseXML(xmlFileData)

    let result = 'Permissions check result:\n'

    // extract nestjs project from zip buffer
    const extractPath = path.join(__dirname, '../../uploads', 'nestjs-project')
    await this.extractNestJsProject(nestJsZipBuffer, extractPath)

    const controllerFiles = this.getControllerFiles(extractPath)
    console.log('Found controller files:', controllerFiles)

    for (let i = 0; i < controllerFiles.length; i++) {
      const fileContent = fs.readFileSync(controllerFiles[i], 'utf8')
      const controllerPermissions = this.getControllerPermissions(fileContent)

      this.buildPermissions(controllerPermissions)
    }

    this.buildRules(modules)

    // console.log('======================== Rules: ', this.rules)
    // console.log('======================== Permissions: ', this.permissions)

    this.filterRedundantPermissions(this.permissions, this.rules)

    this.filterLackRules(this.permissions, this.rules)

    return result
  }

  async parseXML(xmlFileData: string): Promise<any[]> {
    const parser = new xml2js.Parser({ explicitArray: false })
    return new Promise((resolve, reject) => {
      parser.parseString(xmlFileData, (err, result) => {
        if (err) {
          reject('Error parsing XML')
        }
        resolve(result.Policys.Module)
      })
    })
  }

  private async extractNestJsProject(zipBuffer: Buffer, extractPath: string) {
    if (!fs.existsSync(extractPath)) {
      fs.mkdirSync(extractPath, { recursive: true })
    }

    return new Promise((resolve, reject) => {
      const unzipStream = unzipper.Extract({ path: extractPath })
      const bufferStream = new (require('stream').PassThrough)()

      bufferStream.end(zipBuffer)
      bufferStream
        .pipe(unzipStream)
        .on('close', () => {
          console.log('Extraction completed')
          resolve('Extraction completed')
        })
        .on('error', (err) => {
          console.error('Extraction error:', err)
          reject(err)
        })
    })
  }

  private getControllerFiles(srcDir: string): string[] {
    const controllerFiles: string[] = []
    const files = fs.readdirSync(srcDir)

    files.forEach((file) => {
      const filePath = path.join(srcDir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        controllerFiles.push(...this.getControllerFiles(filePath)) // Quét thư mục con
      } else if (file.endsWith('.controller.ts')) {
        controllerFiles.push(filePath) // Lưu file controller
      }
    })

    return controllerFiles
  }

  private getControllerPermissions(
    fileContent: string,
  ): { role: string; action: string; resource: string; condition: string }[] {
    const permissions = []
    const actionRegex = /@(Get|Post|Put|Delete)(?:\(['"](.+)['"]\)|\(\))/g
    const roleRegex = /@Roles\(['"](.+)['"]\)/g
    const controllerRegex = /@Controller\(['"](.+)['"]\)/g
    const conditionRegex =
      /this\.policyService\.checkPermission\([^,]+,\s*[^,]+,\s*['"]([^'"]+)['"]/g

    // Lấy resource từ Controller decorator - chỉ lấy một lần
    let resource = ''
    let controllerMatch = controllerRegex.exec(fileContent)
    if (controllerMatch) {
      resource = controllerMatch[1]
    }

    // Lấy tất cả actions và roles
    const actions = []
    const roles = []
    const conditions = []

    let actionMatch
    while ((actionMatch = actionRegex.exec(fileContent)) !== null) {
      actions.push(actionMatch[1])
    }

    let roleMatch
    while ((roleMatch = roleRegex.exec(fileContent)) !== null) {
      roles.push(roleMatch[1])
    }

    let conditionMatch
    while ((conditionMatch = conditionRegex.exec(fileContent)) !== null) {
      conditions.push(conditionMatch[1].trim())
    }

    const maxLength = Math.max(actions.length, roles.length, conditions.length)
    for (let i = 0; i < maxLength; i++) {
      permissions.push({
        role: roles[i] || '',
        action: actions[i] || '',
        resource: resource,
        condition: conditions[i] || '',
      })
    }

    return permissions
  }

  private buildRules(modules: any) {
    console.log('Modules: ', modules)

    for (const module of modules) {
      let controllers = Array.isArray(module.Controller1)
        ? module.Controller1
        : [module.Controller1]

      for (const controller of controllers) {
        let rules = Array.isArray(controller.Rule)
          ? controller.Rule
          : [controller.Rule]
        for (const rule of rules) {
          if (!rule) continue

          this.rules.push({
            role: rule.Role,
            action: rule.Action,
            resource: rule.Resource,
            condition: rule.Condition?.Restriction || '',
          })
        }
      }
    }
  }

  private buildPermissions(controllerPermission: any) {
    for (const permission of controllerPermission) {
      this.permissions.push(permission)
    }
  }

  private equalCompare(rule: any, permission: any): boolean {
    return (
      rule.role.toLowerCase() === permission.role.toLowerCase() &&
      rule.action.toUpperCase() === permission.action.toUpperCase() &&
      rule.resource.toLowerCase() === permission.resource.toLowerCase() &&
      rule.condition === permission.condition
    )
  }

  private checkPermissionIsMatchToConfigFile(rules: any[], permission: any) {
    for (const rule of rules) {
      if (this.equalCompare(rule, permission)) {
        return true
      }
    }
    return false
  }

  private filterRedundantPermissions(permissions: any[], rules: any[]) {
    for (const permission of permissions) {
      if (!this.checkPermissionIsMatchToConfigFile(rules, permission)) {
        console.log('Redundant=====: ', permission)
      }
    }
  }

  // To check lack rules
  private checkLackRuleToPermissions(permissions: any[], rule: any) {
    for (const permission of permissions) {
      if (this.equalCompare(rule, permission)) {
        return true
      }
    }
    return false
  }

  private filterLackRules(permissions: any[], rules: any[]) {
    for (const rule of rules) {
      if (!this.checkLackRuleToPermissions(permissions, rule)) {
        console.log('Lack ======: ', rule)
      }
    }
  }
}
