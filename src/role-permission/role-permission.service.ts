import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import * as unzipper from 'unzipper'
import * as xml2js from 'xml2js'
import * as ts from 'typescript'

@Injectable()
export class RolePermissionService {
  private rules: any[] = []
  private permissions: any[] = []

  async checkProjectPermissions(xmlFileData: string, nestJsZipBuffer: Buffer) {
    const modules = await this.parseXML(xmlFileData)

    let result = 'Permissions check result:\n'

    // Extract nestjs project from zip buffer
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

    console.log('======================== Rules: ', this.rules)
    console.log('======================== Permissions: ', this.permissions)

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
        controllerFiles.push(...this.getControllerFiles(filePath)) // Recursively scan subdirectories
      } else if (file.endsWith('.controller.ts')) {
        controllerFiles.push(filePath) // Save controller file
      }
    })

    return controllerFiles
  }

  private getControllerPermissions(
    fileContent: string,
  ): { role: string; action: string; resource: string; condition: string }[] {
    const permissions = []

    const sourceFile = ts.createSourceFile(
      'controller.ts',
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const controllerDecorator = this.getDecoratorByName(
      sourceFile,
      'Controller',
    )

    const rolesDecorator = this.getDecoratorByName(sourceFile, 'Roles')
    const actionsDecorators = [
      ...this.getDecoratorByName(sourceFile, 'Get'),
      ...this.getDecoratorByName(sourceFile, 'Post'),
      ...this.getDecoratorByName(sourceFile, 'Put'),
      ...this.getDecoratorByName(sourceFile, 'Delete'),
    ]

    const checkPermissionCalls = this.getCheckPermissionCalls(sourceFile)

    let resource = ''
    if (controllerDecorator.length > 0) {
      const controllerExpression = controllerDecorator[0].expression
      if (
        ts.isCallExpression(controllerExpression) &&
        controllerExpression.arguments.length > 0
      ) {
        const arg = controllerExpression.arguments[0]
        if (ts.isStringLiteral(arg)) {
          resource = arg.text
        }
      }
    }

    let roles: string[] = []
    if (rolesDecorator.length > 0) {
      roles = rolesDecorator.map((d) => {
        const roleExpression = d.expression
        if (
          ts.isCallExpression(roleExpression) &&
          roleExpression.arguments.length > 0
        ) {
          const arg = roleExpression.arguments[0]
          if (ts.isStringLiteral(arg)) {
            return arg.text
          }
        }
        return ''
      })
    }

    let actions: string[] = []
    if (actionsDecorators.length > 0) {
      actions = actionsDecorators.map((d) => {
        if (
          ts.isCallExpression(d.expression) &&
          ts.isIdentifier(d.expression.expression)
        ) {
          return d.expression.expression.getText().toLowerCase()
        }
        return ''
      })
    }

    let conditions: string[] = []
    if (checkPermissionCalls.length > 0) {
      conditions = checkPermissionCalls.map((call) => {
        if (ts.isCallExpression(call)) {
          const conditionArg = call.arguments[2]
          if (ts.isStringLiteral(conditionArg)) {
            // console.log('Condition arg: ', conditionArg.text)
            return conditionArg.text
          }
        }

        return ''
      })
    }

    const maxLength = Math.max(actions.length, roles.length)

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

  private getDecoratorByName(
    sourceFile: ts.SourceFile,
    decoratorName: string,
  ): ts.Decorator[] {
    const decorators: ts.Decorator[] = []
    const visitNode = (node: ts.Node) => {
      if (ts.isDecorator(node) && ts.isCallExpression(node.expression)) {
        if (node.expression.expression.getText() === decoratorName) {
          decorators.push(node)
        }
      }
      ts.forEachChild(node, visitNode)
    }
    visitNode(sourceFile)
    return decorators
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

  private getCheckPermissionCalls(sourceFile: ts.SourceFile) {
    const calls: ts.CallExpression[] = []

    const visitNode = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const expression = node.expression
        if (
          ts.isPropertyAccessExpression(expression) &&
          expression.name.text === 'checkPermission'
        ) {
          calls.push(node)
        }
      }
      ts.forEachChild(node, visitNode)
    }

    visitNode(sourceFile)
    return calls
  }
}
