import { LlmService } from '@/llm/llm.service'
import {
  extractConstraints,
  extractNestJsProject,
  extractResourceNames,
  getPolicyContentFromControllerContent,
  getServiceContentFromControllerContent,
  parseXML,
} from '@/shared/role-permission'
import { Injectable } from '@nestjs/common'
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
    try {
      await extractNestJsProject(nestJsZipBuffer, extractPath)

      const modules = await parseXML(xmlFileData)

      // Filter controller files
      const controllerEntries = entries.filter(
        (entry) =>
          entry.entryName.endsWith('.controller.ts') &&
          !entry.isDirectory &&
          !entry.entryName.includes('/auth/') &&
          !entry.entryName.includes('/user/') &&
          !entry.entryName.endsWith('app.controller.ts'),
      )

      const controllerFiles = controllerEntries.map((entry) => entry.entryName)

      console.log('Controller files: ', controllerFiles)

      for (const entry of controllerEntries) {
        const fileContent = entry.getData().toString('utf8')

        const controllerPermissions = await this.getControllerPermissions(
          fileContent,
          extractPath,
        )
        this.buildPermissions(controllerPermissions)
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

      const redundantRule = this.filterRedundantPermissions(
        this.permissions,
        this.rules,
      )
      const lackRule = this.filterLackRules(this.permissions, this.rules)

      this.rules = []
      this.permissions = []

      return {
        redundantRule,
        lackRule,
      }
    } catch (error) {
      throw new Error("Can't check project permissions")
    } finally {
      // if (fs.existsSync(extractPath)) {
      //   fs.rmSync(extractPath, { recursive: true, force: true })
      //   console.log(`Cleaned up extracted project at: ${extractPath}`)
      // }
    }
  }

  private async getControllerPermissions(
    fileContent: string,
    projectPath: string,
  ) {
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

    let serviceMethods = await this.extractServiceMethods(fileContent)

    // console.log('Service methods: ', serviceMethods)

    const extractPath = path.join(__dirname, '../../uploads', 'nestjs-project')

    const serviceContent = await getServiceContentFromControllerContent(
      fileContent,
      extractPath,
    )

    let controllerOperations = await this.getControllerOperations(fileContent)

    let constraintPolicies = ''
    // console.log('Controller operations: ', controllerOperations)

    constraintPolicies = await this.getConstraintPolicies(
      controllerOperations,
      fileContent,
    )

    console.log('Constraint policies: ', constraintPolicies)

    let policyContent = await getPolicyContentFromControllerContent(
      fileContent,
      extractPath,
    )

    // console.log('Controller operations: ', controllerOperations)
    // console.log('Constraint decorators: ', constraintPolicies)
    // console.log('Policy content: ', policyContent)

    let conditionString = ''
    let conditions = []
    if (constraintPolicies) {
      conditionString = await this.llmService.getConstraint(
        controllerOperations,
        constraintPolicies,
        policyContent[0]?.content || '',
      )

      // console.log('Condition string: ', conditionString)

      // conditionString = await this.llmService.getConstraintHuggingFace(
      //   controllerOperations,
      //   constraintPolicies,
      //   policyContent[0]?.content || '',
      // )

      const cleanedString = this.formatConstraintString(conditionString)
      conditions = extractConstraints(cleanedString)
    }

    let resourceString = ''
    let resource = []

    resourceString = await this.llmService.getResourceName(
      serviceMethods,
      serviceContent?.content,
    )

    // console.log('Resource string: ', resourceString)

    // resourceString = await this.llmService.getResourceNameHuggingFace(
    //   serviceMethods,
    //   serviceContent?.content,
    // )

    resource = extractResourceNames(resourceString)

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

    const maxLength = Math.max(actions.length, roles.length)

    console.log('actions: ', actions)

    for (let i = 0; i < maxLength; i++) {
      permissions.push({
        role: roles[i] || '',
        action: actions[i] || '',
        resource: resource[i] || '',
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
    // console.log('Modules: ', modules)

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
            condition: rule.Condition?.Restriction?.replace(/ /g, '') || '',
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
      rule.action.toLowerCase() === permission.action.toLowerCase() &&
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
    const result = []
    for (const permission of permissions) {
      if (!this.checkPermissionIsMatchToConfigFile(rules, permission)) {
        // console.log('Redundant=====: ', permission)
        result.push(permission)
      }
    }
    return result
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
    const result = []
    for (const rule of rules) {
      if (!this.checkLackRuleToPermissions(permissions, rule)) {
        // console.log('Lack ======: ', rule)
        result.push(rule)
      }
    }
    return result
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

    const methodPattern = new RegExp(`this\\.${serviceName}\\.(\\w+)\\(`, 'g')
    const matches = [...cleanCode.matchAll(methodPattern)]

    // console.log('Matches: ', matches)

    const methodNames = [...new Set(matches.map((match) => match[1]))].sort()

    return methodNames
  }

  private async getControllerOperations(controllerContent: string) {
    const sourceFile = ts.createSourceFile(
      'controller.ts',
      controllerContent,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TS,
    )

    const methodNames: string[] = []

    function visit(node: ts.Node) {
      if (
        ts.isMethodDeclaration(node) &&
        node.name &&
        ts.isIdentifier(node.name)
      ) {
        methodNames.push(node.name.text)
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)

    return methodNames
  }

  private async getConstraintPolicies(
    operations: string[],
    controllerContent: string,
  ) {
    // Object to store the results
    const result: Record<string, string[]> = {}

    // Initialize result with empty arrays for all requested operations
    operations.forEach((op) => {
      result[op] = []
    })

    // Process the controller content for each operation
    operations.forEach((operation) => {
      // Find the method definition for this operation
      const methodRegex = new RegExp(`\\s+${operation}\\s*\\(`, 'i')
      const methodMatch = controllerContent.match(methodRegex)

      if (methodMatch) {
        // Find the position of the method
        const methodPos = methodMatch.index

        if (methodPos) {
          // Look backwards from the method to find the CheckPolicies decorator
          const sectionStart = Math.max(0, methodPos - 200) // Look back 200 chars at most
          const methodSection = controllerContent.substring(
            sectionStart,
            methodPos,
          )

          // Extract policy from CheckPolicies decorator
          const policyMatch = methodSection.match(
            /@CheckPolicies\(new\s+(\w+)\(\)\)/,
          )

          if (policyMatch && policyMatch[1]) {
            result[operation].push(policyMatch[1])
          }
        }
      }
    })

    // Format the output as requested: "operation: [Policy1, Policy2], ..."
    return operations
      .filter((op) => result[op].length > 0)
      .map((op) => `${op}: [${result[op].join(', ')}]`)
      .join(', ')
  }

  private formatConstraintString(constraintString: string) {
    return constraintString.replace(/['"]/g, '').replace(/ /g, '')
  }
}
