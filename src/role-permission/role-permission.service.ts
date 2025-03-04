import { LlmService } from '@/llm/llm.service'
import {
  extractNestJsProject,
  getServiceContentFromControllerContent,
  parseXML,
} from '@/shared/role-permission'
import { Injectable } from '@nestjs/common'
import * as fs from 'fs'
import * as path from 'path'
import * as ts from 'typescript'

@Injectable()
export class RolePermissionService {
  private rules: any[] = []
  private permissions: any[] = []

  constructor(private readonly llmService: LlmService) {}

  async checkProjectPermissions(xmlFileData: string, nestJsZipBuffer: Buffer) {
    const AdmZip = require('adm-zip')
    const zip = new AdmZip(nestJsZipBuffer)
    const entries = zip.getEntries()

    const extractPath = path.join(__dirname, '../../uploads', 'nestjs-project')
    await extractNestJsProject(nestJsZipBuffer, extractPath)

    const modules = await parseXML(xmlFileData)
    let result = 'Permissions check result:\n'

    // Filter controller files
    const controllerEntries = entries.filter(
      (entry) =>
        entry.entryName.endsWith('.controller.ts') && !entry.isDirectory,
    )

    console.log(
      'Found controller files:',
      controllerEntries.map((e) => e.entryName),
    )

    for (const entry of controllerEntries) {
      const fileContent = entry.getData().toString('utf8')
      const controllerPermissions = this.getControllerPermissions(fileContent)
      // this.buildPermissions(controllerPermissions)
    }
    this.buildRules(modules)

    console.log(
      '======================== Rules: ',
      this.rules.length,
      this.rules,
    )

    console.log(
      '======================== Permissions: ',
      this.permissions.length,
      this.permissions,
    )

    // this.filterRedundantPermissions(this.permissions, this.rules)
    // this.filterLackRules(this.permissions, this.rules)

    return result
  }

  private getControllerFiles(srcDir: string): string[] {
    const controllerFiles: string[] = []
    const files = fs.readdirSync(srcDir)

    files.forEach((file) => {
      const filePath = path.join(srcDir, file)
      const stat = fs.statSync(filePath)
      if (stat.isDirectory()) {
        controllerFiles.push(...this.getControllerFiles(filePath))
      } else if (file.endsWith('.controller.ts')) {
        controllerFiles.push(filePath) // Save controller file
      }
    })

    return controllerFiles
  }

  private async getControllerPermissions(fileContent: string) {
    const permissions = []

    const sourceFile = ts.createSourceFile(
      'controller.ts',
      fileContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const rolesDecorator = this.getDecoratorByName(sourceFile, 'Roles')
    const actionsDecorators = [
      ...this.getDecoratorByName(sourceFile, 'Get'),
      ...this.getDecoratorByName(sourceFile, 'Post'),
      ...this.getDecoratorByName(sourceFile, 'Put'),
      ...this.getDecoratorByName(sourceFile, 'Delete'),
    ]

    let resource

    let serviceMethods = await this.extractServiceMethods(fileContent)

    console.log('Service methods: ', serviceMethods)

    const extractPath = path.join(__dirname, '../../uploads', 'nestjs-project')

    const serviceContent = await getServiceContentFromControllerContent(
      fileContent,
      extractPath,
    )

    // console.log('controller file: ', fileContent)
    // console.log('check service content: ', serviceContent)

    resource = await this.llmService.getResourceName(
      serviceMethods,
      serviceContent?.content,
    )

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

    const checkPermissionConditions = this.getCheckPermissionCalls(sourceFile)

    let conditions: string[] = []
    if (checkPermissionConditions.length > 0) {
      conditions = checkPermissionConditions.map((call) => {
        if (ts.isCallExpression(call)) {
          const conditionArg = call.arguments[2]
          if (ts.isStringLiteral(conditionArg)) {
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

  private async extractServiceMethods(controllerCode) {
    // Remove comments
    const cleanCode = controllerCode
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')

    const constructorMatch = cleanCode.match(
      /constructor\s*\(\s*(?:(?:private|protected|public)\s+)?(?:readonly\s+)?(?:(?:private|protected|public)\s+)?(\w+)\s*:/,
    )

    if (!constructorMatch || !constructorMatch[1]) {
      return {
        success: false,
        error: 'Cannot find service constructor',
        functions: [],
      }
    }

    const serviceName = constructorMatch[1]

    console.log('Service name: ', serviceName)

    const methodPattern = new RegExp(`this\\.${serviceName}\\.(\\w+)\\(`, 'g')
    const matches = [...cleanCode.matchAll(methodPattern)]

    const methodNames = [...new Set(matches.map((match) => match[1]))].sort()

    return methodNames
  }
}
