import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class SwaggerSetupService {
  private readonly logger = new Logger(SwaggerSetupService.name)

  async setup(projectPath: string): Promise<void> {
    try {
      this.updateDependencies(projectPath)

      this.updateMainFile(projectPath)

      this.createSwaggerConfig(projectPath)

      this.logger.debug('Swagger setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup swagger: ${error.message}`)
      throw error
    }
  }

  private async updateDependencies(projectPath: string): Promise<void> {
    // Add dependencies to package.json
    console.log('Updating swagger dependencies---')
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = await fs.readJson(packageJsonPath)

    // Add swagger dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      '@nestjs/swagger': '^8.1.1',
      'swagger-ui-express': '^5.0.1',
    }

    // Write back package.json
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
  }

  private async updateMainFile(projectPath: string): Promise<void> {
    // main.ts update logic
    // Update main.ts
    const mainFilePath = path.join(projectPath, 'src/main.ts')
    let mainContent = await fs.readFile(mainFilePath, 'utf8')

    // Add swagger imports
    const swaggerImports = `import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';\n`
    mainContent = swaggerImports + mainContent

    // Add swagger setup
    const swaggerSetup = `
  // Swagger Configuration
  const config = new DocumentBuilder()
    .setTitle('API Documentation')
    .setDescription('Your API Description')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);
  `

    // Add swagger setup after app.listen
    mainContent = mainContent.replace(
      'await app.listen(',
      `${swaggerSetup}\n  await app.listen(`,
    )

    // Write back main.ts
    await fs.writeFile(mainFilePath, mainContent, 'utf8')
  }

  // Create config directory
  private async createSwaggerConfig(projectPath: string): Promise<void> {
    const configDir = path.join(projectPath, 'src/config')
    await fs.ensureDir(configDir)

    const swaggerConfigContent = `import { DocumentBuilder } from '@nestjs/swagger';

export const swaggerConfig = new DocumentBuilder()
  .setTitle('API Documentation')
  .setDescription('Your API Description')
  .setVersion('1.0')
  .addBearerAuth()
  .addTag('api')
  .build();
          `

    await fs.writeFile(
      path.join(configDir, 'swagger.config.ts'),
      swaggerConfigContent,
    )
  }
}
