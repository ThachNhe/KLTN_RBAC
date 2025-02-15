import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'
import * as xml2js from 'xml2js'

@Injectable()
export class PolicySetupService {
  private readonly logger = new Logger(PolicySetupService.name)

  async setup(projectPath: string, configXmlPath: string): Promise<void> {
    try {
      // Read XML content
      const xmlContent = await fs.readFile(configXmlPath, 'utf8')

      // Parse XML to JSON
      const data = await xml2js.parseStringPromise(xmlContent)

      const modules = data?.Policys?.Module || []
      if (!modules.length) {
        this.logger.warn('Cannot find any module in the XML.')
        return
      }

      for (const moduleElem of modules) {
        const moduleName = moduleElem.Name?.[0]
        if (!moduleName) {
          this.logger.warn('Cannot find module name in the XML.')
          continue
        }

        // Create module files
        await this.createModuleFiles(projectPath, moduleName, moduleElem)
        this.logger.log(`Created module files for ${moduleName}`)
      }

      // Register modules in app.module.ts
      await this.registerModulesInAppModule(
        projectPath,
        modules.map((m) => m.Name[0]),
      )

      this.logger.debug('Policy setup completed!')
    } catch (error) {
      this.logger.error(`Failed to setup policy: ${error.message}`)
      throw error
    }
  }

  private async createModuleFiles(
    projectPath: string,
    moduleName: string,
    moduleElem: any,
  ): Promise<void> {
    const moduleDir = path.join(projectPath, 'src', moduleName)
    await fs.ensureDir(moduleDir)

    const moduleFilePath = path.join(moduleDir, `${moduleName}.module.ts`)
    const moduleFileContent = this.generateModuleFileContent(moduleName)
    await fs.writeFile(moduleFilePath, moduleFileContent, 'utf8')

    const controllerFilePath = path.join(
      moduleDir,
      `${moduleName}.controller.ts`,
    )
    const controllerFileContent = this.generateControllerFileContent(
      moduleName,
      moduleElem,
      projectPath,
    )
    await fs.writeFile(controllerFilePath, controllerFileContent, 'utf8')
  }

  private generateModuleFileContent(moduleName: string): string {
    const className = this.capitalizeFirstLetter(moduleName) + 'Module'

    return `import { Module } from '@nestjs/common';
import { ${this.capitalizeFirstLetter(moduleName)}Controller } from './${moduleName}.controller';

@Module({
  imports: [],
  controllers: [${this.capitalizeFirstLetter(moduleName)}Controller],
  providers: [],
})
export class ${className} {}
`
  }

  private generateControllerFileContent(
    moduleName: string,
    moduleElem: any,
    projectPath: string,
  ): string {
    const className = this.capitalizeFirstLetter(moduleName) + 'Controller'

    let rules: any[] = []
    if (moduleElem.Controller1 && moduleElem.Controller1[0].Rule) {
      rules = moduleElem.Controller1[0].Rule
    }

    let methodsContent = ''

    for (const rule of rules) {
      const action = rule.Action?.[0] ?? 'GET'
      const resource = rule.Resource?.[0] ?? 'SomeResource'
      const role = rule.Role?.[0] ?? 'ANY_ROLE'
      const methodName = rule.Name?.[0] ?? 'defaultMethodName'

      console.log('rule condition ===================', rule.Condition)

      // Create method content
      methodsContent += `
  @${this.mapHttpAction(action)}('${resource.toLowerCase()}')
  @Roles('${role}')
  @UseGuards(RolesGuard)
  ${methodName}() {
    ${rule.Condition ? this.addCondition(rule.Condition?.[0]?.Restriction?.[0], projectPath) : ''}
    return \`${action} /${resource} => only for ${role}\`;
  }
`
    }

    return `import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';

@Controller('${moduleName}')
export class ${className} {
  ${methodsContent}
}
`
  }

  private async registerModulesInAppModule(
    projectPath: string,
    moduleNames: string[],
  ) {
    const appModulePath = path.join(projectPath, 'src/app.module.ts')
    if (!(await fs.pathExists(appModulePath))) {
      this.logger.warn(
        'Cannot find app.module.ts. You must import modules manually.',
      )
      return
    }

    let appModuleContent = await fs.readFile(appModulePath, 'utf8')

    let importSnippet = ''
    let moduleListSnippet = ''
    for (const name of moduleNames) {
      const className = this.capitalizeFirstLetter(name) + 'Module'
      importSnippet += `import { ${className} } from './${name}/${name}.module';\n`
      moduleListSnippet += `${className}, `
    }

    appModuleContent = importSnippet + '\n' + appModuleContent

    const importsRegex = /imports:\s*\[([\s\S]*?)\]/
    const match = appModuleContent.match(importsRegex)
    if (!match) {
      this.logger.warn(`Cannot import modules automatically.`)
    } else {
      const oldImports = match[1]
      const newImports = oldImports.trim().endsWith(',')
        ? oldImports.trim() + ' ' + moduleListSnippet
        : oldImports.trim() + ', ' + moduleListSnippet

      const replaced = appModuleContent.replace(
        importsRegex,
        `imports: [${newImports}]`,
      )
      appModuleContent = replaced
      this.logger.log(`Have inserted into: ${moduleNames.join(', ')}.`)
    }

    await fs.writeFile(appModulePath, appModuleContent, 'utf8')
  }

  private capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private mapHttpAction(action: string) {
    switch (action.toUpperCase()) {
      case 'GET':
        return 'Get'
      case 'POST':
        return 'Post'
      case 'PUT':
        return 'Put'
      case 'DELETE':
        return 'Delete'
      default:
        return 'Get'
    }
  }

  private addPolicyService(projectPath: string) {
    const policyDir = path.join(projectPath, 'src/auth/policy')
    fs.ensureDirSync(policyDir)

    const policyServicePath = path.join(policyDir, 'policy.service.ts')

    const policyServiceContent = `
import { Injectable, ForbiddenException } from '@nestjs/common';
import { parse, evaluate } from 'expression-eval';

@Injectable()
export class PolicyService {
  check(
    subject: any,
    resource: any,
    condition: string,
    environment?: Record<string, any>
  ): boolean {
    const context = {
      subject,
      resource,
      environment: environment || {},
    };

    const ast = parse(condition);

    return evaluate(ast, context);
  }

  checkPermission(
    subject: any,
    resource: any,
    condition: string,
    environment?: Record<string, any>
  ) {
    const result = this.check(subject, resource, condition, environment);
    if (!result) {
      throw new ForbiddenException('Access is denied');
    }
  }
}    
`
    fs.writeFileSync(policyServicePath, policyServiceContent, 'utf8')
  }

  private addCondition(restriction: string, projectPath: string) {
    this.addPolicyService(projectPath)

    return `this.policyService.checkPermission(user, resource, '${restriction}');`
  }
}
