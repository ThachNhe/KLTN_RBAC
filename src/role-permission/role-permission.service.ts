import { LlmService } from '@/llm/llm.service'
import {
  extractNestJsProject,
  extractServiceContent,
  getPolicyContentFromControllerContent,
  getServiceContentFromControllerContent,
  parseXML,
} from '@/shared/role-permission'
import { Injectable } from '@nestjs/common'
import * as path from 'path'

@Injectable()
export class RolePermissionService {
  private rules: any[] = []
  private permissions: any[] = []

  constructor(private readonly llmService: LlmService) {}

  async checkRolePermissionViolation(
    xmlFileData: string,
    nestJsZipBuffer: Buffer,
  ) {
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

      // console.log('controllerEntries: ', controllerEntries)

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
    controllerFileContent: string,
    projectPath: string,
  ) {
    //
    let controllerMethodMappingArr = this.getControllerServiceMapping(
      controllerFileContent,
    )

    // console.log('Controller method mapping: ', controllerMethodMappingArr)

    let serviceMethods = await this.extractServiceMethods(controllerFileContent)

    // console.log('Service methods: ', serviceMethods)

    const extractPath = path.join(__dirname, '../../uploads', 'nestjs-project')

    const fullServiceContent = await getServiceContentFromControllerContent(
      controllerFileContent,
      extractPath,
    )

    // const extractedServiceContent = extractServiceContent(
    //   fullServiceContent?.content,
    //   serviceMethods as string[],
    // )
    // console.log('Extracted service content:==== ', extractedServiceContent)

    let resources = []

    // console.log('controllerMethodMappingArr : ', controllerMethodMappingArr)

    // console.log('Resources: ', resources)

    // Solution 2 to get resource name

    // console.log('Resources++++++++++++: ', resources)

    resources = await this.llmService.getResourceName(
      controllerMethodMappingArr,
      serviceMethods,
      fullServiceContent?.content,
    )

    // resources = await this.llmService.getResourceNameHuggingFace(
    //   controllerMethodMappingArr,
    //   serviceMethods,
    //   fullServiceContent?.content,
    // )

    const policyMethods = this.extractPolicies(controllerFileContent)

    const controllerMethodsAndPolicies =
      this.extractControllerMethodsAndPolicies(controllerFileContent)

    let policyContent = await getPolicyContentFromControllerContent(
      controllerFileContent,
      extractPath,
    )

    let policies = []
    if (policyMethods) {
      policies = await this.llmService.getConstraint(
        controllerMethodsAndPolicies,
        policyMethods,
        policyContent[0]?.content || '',
      )
      // policies = await this.llmService.getConstraintHuggingFace(
      //   controllerMethodsAndPolicies,
      //   policyMethods,
      //   policyContent[0]?.content || '',
      // )
    }

    const roles = this.extractControllerMethodsAndRoles(controllerFileContent)

    const actions = this.extractControllerMethodsAndHttpMethods(
      controllerFileContent,
    )

    // console.log('policies: ', policies)

    // console.log('resource: ', resources)

    // console.log('roles: ', roles)

    // console.log('Actions: ', actions)

    const accessRules = this.extractAccessRules(
      policies,
      resources,
      roles,
      actions,
    )

    // console.log('Access rules: ', accessRules)

    return accessRules || []
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
    const normalizeCondition = (condition: string) =>
      condition.replace(/\s+/g, '')

    return (
      rule.role.toLowerCase() === permission.role.toLowerCase() &&
      rule.action.toLowerCase() === permission.action.toLowerCase() &&
      rule.resource.toLowerCase() === permission.resource.toLowerCase() &&
      normalizeCondition(rule.condition) ===
        normalizeCondition(permission.condition)
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

  // map controller method to service method
  private getControllerServiceMapping(controllerContent) {
    const serviceNameMatch = controllerContent.match(
      /constructor\s*\(\s*private\s+(?:readonly\s+)?(\w+)\s*:\s*\w+Service\s*\)/,
    )

    if (!serviceNameMatch) {
      throw new Error('Cannot find service constructor')
    }
    const serviceName = serviceNameMatch[1]

    const methodBlocks =
      controllerContent.match(/async\s+\w+\([^{]*\)\s*{[^}]*}/g) || []

    const results = []

    methodBlocks.forEach((block) => {
      const controllerMethodMatch = block.match(/async\s+(\w+)/)
      if (!controllerMethodMatch) return
      const controllerMethod = controllerMethodMatch[1]

      const serviceMethodMatch = block.match(
        new RegExp(`this\\.${serviceName}\\.(\\w+)`),
      )
      if (!serviceMethodMatch) return
      const serviceMethod = serviceMethodMatch[1]

      results.push({ [controllerMethod]: serviceMethod })
    })

    return results
  }

  private extractPolicies(sourceCode) {
    const policyRegex =
      /@CheckPolicies\s*\(\s*new\s+([A-Za-z0-9_]+Policy)\s*\(\s*\)\s*\)/g

    const policies = []
    let match

    while ((match = policyRegex.exec(sourceCode)) !== null) {
      policies.push(match[1])
    }

    return policies
  }

  private extractControllerMethodsAndPolicies(sourceCode) {
    const result = []

    const methodRegex = /async\s+([a-zA-Z0-9_]+)\s*\([^)]*\)/g
    const policyRegex =
      /@CheckPolicies\s*\(\s*new\s+([A-Za-z0-9_]+)\s*\(\s*\)\s*\)/g

    const methods = []
    let methodMatch
    while ((methodMatch = methodRegex.exec(sourceCode)) !== null) {
      methods.push({
        name: methodMatch[1],
        position: methodMatch.index,
      })
    }

    const policies = []
    let policyMatch
    while ((policyMatch = policyRegex.exec(sourceCode)) !== null) {
      policies.push({
        name: policyMatch[1],
        position: policyMatch.index,
      })
    }

    for (const method of methods) {
      let closestPolicy = null
      let minDistance = Infinity

      for (const policy of policies) {
        if (policy.position < method.position) {
          const distance = method.position - policy.position
          if (distance < minDistance) {
            minDistance = distance
            closestPolicy = policy
          }
        }
      }

      if (closestPolicy) {
        result.push({ [method.name]: closestPolicy.name })
      }
    }

    return result
  }

  private extractControllerMethodsAndHttpMethods(sourceCode) {
    const result = []

    const httpMethodRegex =
      /@(Get|Post|Put|Delete|Patch|Options|Head)(\([^)]*\))?/g
    const methodRegex = /async\s+([a-zA-Z0-9_]+)\s*\([^)]*\)/g

    const methods = []
    let methodMatch
    while ((methodMatch = methodRegex.exec(sourceCode)) !== null) {
      methods.push({
        name: methodMatch[1],
        position: methodMatch.index,
      })
    }

    const httpMethods = []
    let httpMethodMatch
    while ((httpMethodMatch = httpMethodRegex.exec(sourceCode)) !== null) {
      httpMethods.push({
        method: httpMethodMatch[1].toLowerCase(),
        position: httpMethodMatch.index,
      })
    }

    for (const method of methods) {
      let closestHttpMethod = null
      let minDistance = Infinity

      for (const httpMethod of httpMethods) {
        if (httpMethod.position < method.position) {
          const distance = method.position - httpMethod.position
          if (distance < minDistance) {
            minDistance = distance
            closestHttpMethod = httpMethod
          }
        }
      }

      if (closestHttpMethod) {
        result.push({ [method.name]: closestHttpMethod.method })
      }
    }

    return result
  }

  private extractControllerMethodsAndRoles(sourceCode) {
    const result = []

    const roleRegex = /@Roles\(\s*['"]([A-Z_]+)['"]\s*\)/g
    const methodRegex = /async\s+([a-zA-Z0-9_]+)\s*\([^)]*\)/g

    const methods = []
    let methodMatch
    while ((methodMatch = methodRegex.exec(sourceCode)) !== null) {
      methods.push({
        name: methodMatch[1],
        position: methodMatch.index,
      })
    }

    const roles = []
    let roleMatch
    while ((roleMatch = roleRegex.exec(sourceCode)) !== null) {
      roles.push({
        role: roleMatch[1],
        position: roleMatch.index,
      })
    }

    for (const method of methods) {
      let closestRole = null
      let minDistance = Infinity

      for (const role of roles) {
        if (role.position < method.position) {
          const distance = method.position - role.position
          if (distance < minDistance) {
            minDistance = distance
            closestRole = role
          }
        }
      }

      if (closestRole) {
        result.push({ [method.name]: closestRole.role })
      }
    }

    return result
  }

  private extractAccessRules(
    policies: any,
    resources: any,
    roles: any,
    actions: any,
  ): any {
    const result = []

    const keys = new Set<string>()
    ;[...policies, ...resources, ...roles, ...actions].forEach((item) => {
      Object.keys(item).forEach((key) => keys.add(key))
    })

    keys.forEach((key) => {
      const policyItem = policies.find((item) => key in item)
      const resourceItem = resources.find((item) => key in item)
      const roleItem = roles.find((item) => key in item)
      const actionItem = actions.find((item) => key in item)

      if (policyItem && resourceItem && roleItem && actionItem) {
        result.push({
          role: roleItem[key],
          action: actionItem[key],
          resource: resourceItem[key],
          condition: policyItem[key],
        })
      }
    })

    return result
  }
}
