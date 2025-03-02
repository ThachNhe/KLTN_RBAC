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
      await this.createPolicyInfrastructure(projectPath)

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

  async createPolicyInfrastructure(projectPath: string): Promise<void> {
    const policyDir = path.join(projectPath, 'src', 'policy')
    await fs.ensureDir(policyDir)

    // create policy decorators
    const policyDecoratorPath = path.join(policyDir, 'policy.decorator.ts')
    const policyDecoContent = `import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICIES_KEY = 'check_policy';
export const CheckPolicies = (...handlers: PolicyHandler[]) => 
  SetMetadata(CHECK_POLICIES_KEY, handlers);

export interface PolicyHandler {
  handle(user: any, resource: any): boolean;
}`

    await fs.writeFile(policyDecoratorPath, policyDecoContent, 'utf8')

    // Create base policy handler
    const policyHandlerPath = path.join(policyDir, 'policy.handler.ts')
    const policyHandlerContent = `import { Injectable } from '@nestjs/common';
import { PolicyHandler } from './policy.decorator';

@Injectable()
export class PolicyHandlerBase implements PolicyHandler {
  constructor(private condition: string) {}

  handle(user: any, resource: any): boolean {
    try {
      const context = { subject: user, resource };
      const evaluator = new Function('context', \`
        const { subject, resource } = context;
        return \${this.condition};
      \`);
      
      return evaluator(context);
    } catch (error) {
      console.error('Policy evaluation error:', error);
      return false;
    }
  }
}`

    await fs.writeFile(policyHandlerPath, policyHandlerContent, 'utf8')

    // Create policy guard
    const policyGuardPath = path.join(policyDir, 'policies.guard.ts')
    const policyGuardContent = `import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { CHECK_POLICIES_KEY, PolicyHandler } from './policy.decorator';

@Injectable()
export class PoliciesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const policyHandlers = this.reflector.get<PolicyHandler[]>(
      CHECK_POLICIES_KEY,
      context.getHandler(),
    ) || [];

    if (policyHandlers.length === 0) {
      return true; 
    }

    const { user } = context.switchToHttp().getRequest();
    
    const request = context.switchToHttp().getRequest();
    const resourceId = request.params.id;
    const resource = request.body; 
    
    return policyHandlers.every(handler => handler.handle(user, resource));
  }
}`

    await fs.writeFile(policyGuardPath, policyGuardContent, 'utf8')

    // Create policy module
  }

  async createPolicyFile(
    projectPath: string,
    moduleName: string,
    moduleElem: any,
  ) {
    const policyDir = path.join(projectPath, 'src', moduleName, 'policies')
    await fs.ensureDir(policyDir)

    const policyFilePath = path.join(policyDir, `${moduleName}.policy.ts`)

    let rules: any[] = []
    if (moduleElem.Controller1 && moduleElem.Controller1[0].Rule) {
      rules = moduleElem.Controller1[0].Rule
    }

    let policyContent = `import { Injectable } from '@nestjs/common';
import { PolicyHandler } from '@/policy/policy.decorator';
import { PolicyHandlerBase } from '@/policy/policy.handler';

`
    let defaultPolicyContent = `@Injectable()
export class defaultPolicy extends PolicyHandlerBase {
  constructor() {
    super('');
  }
}`
    policyContent += defaultPolicyContent
    // Generate policy handlers for each rule that has conditions
    for (const rule of rules) {
      if (rule.Condition && rule.Condition[0].Restriction) {
        const restriction = rule.Condition[0].Restriction[0]
        const methodName = rule.Name?.[0] ?? 'defaultMethodName'
        const policyName = this.capitalizeFirstLetter(methodName) + 'Policy'

        policyContent += `@Injectable()
export class ${policyName} extends PolicyHandlerBase {
  constructor() {
    super('${restriction}');
  }
}

`
      }
    }

    await fs.writeFile(policyFilePath, policyContent, 'utf8')
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
    await this.createPolicyFile(projectPath, moduleName, moduleElem)
  }

  private generateModuleFileContent(moduleName: string): string {
    const className = this.capitalizeFirstLetter(moduleName) + 'Module'

    return `import { Module } from '@nestjs/common';
import { ${this.capitalizeFirstLetter(moduleName)}Controller } from './${moduleName}.controller';
import * as ${moduleName}Policies from './policies/${moduleName}.policy';

@Module({
  imports: [],
  controllers: [${this.capitalizeFirstLetter(moduleName)}Controller],
  providers: [
    ...Object.values(${moduleName}Policies),
  ],
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

    let imports = `import { Controller, Get, Post, Put, Delete, UseGuards, Param, Body } from '@nestjs/common';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { RolesGuard } from 'src/auth/guards/roles.guard';
import { PoliciesGuard } from '@/policy/policies.guard';
import { CheckPolicies } from '@/policy/policy.decorator';
`

    // Import policy files
    let hasPolicyImports = false
    for (const rule of rules) {
      if (rule.Condition && rule.Condition[0].Restriction) {
        if (!hasPolicyImports) {
          hasPolicyImports = true
        }
        const methodName = rule.Name?.[0] ?? 'defaultMethodName'
        const policyName = this.capitalizeFirstLetter(methodName) + 'Policy'
        imports += `import { ${policyName} } from './policies/${moduleName}.policy';\n`
      }
    }

    let methodsContent = ''

    for (const rule of rules) {
      const action = rule.Action?.[0] ?? 'GET'
      const resource = rule.Resource?.[0] ?? 'SomeResource'
      const role = rule.Role?.[0] ?? 'ANY_ROLE'
      const methodName = rule.Name?.[0] ?? 'defaultMethodName'

      let policyDecorator = ''
      if (rule.Condition && rule.Condition[0].Restriction) {
        const policyName = this.capitalizeFirstLetter(methodName) + 'Policy'
        policyDecorator = `  @CheckPolicies(new ${policyName}())\n  @UseGuards(PoliciesGuard)\n`
      }

      // Create method content
      methodsContent += `
  @${this.mapHttpAction(action)}('${resource.toLowerCase()}')
  @Roles('${role}')
  @UseGuards(RolesGuard)
${policyDecorator}  ${methodName}(@Param() params, @Body() body) {
    return \`${action} /${resource} => only for ${role}\`;
  }
`
    }

    return `${imports}

@Controller('${moduleName}')
export class ${className} {${methodsContent}
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
}
