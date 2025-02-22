import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class SwaggerSetupService {
  private readonly logger = new Logger(SwaggerSetupService.name)

  async setup(projectPath: string) {
    try {
      await this.updateDependencies(projectPath)

      this.updateMainFile(projectPath)

      this.createSwaggerConfig(projectPath)

      this.logger.debug('Swagger setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup swagger: ${error.message}`)
      throw error
    }
  }

  private async updateDependencies(projectPath: string) {
    // Add dependencies to package.json
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = await fs.readJson(packageJsonPath)

    // Add swagger dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      '@nestjs/swagger': '^7.4.2',
      'swagger-ui-express': '^5.0.1',
    }

    // Write back package.json
    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
  }

  private async updateMainFile(projectPath: string) {
    const mainFilePath = path.join(projectPath, 'src/main.ts')
    let mainContent = await fs.readFile(mainFilePath, 'utf8')

    const swaggerConfig = `import { swagger } from './config/swagger.config';`

    mainContent = `${swaggerConfig}\n${mainContent}`

    mainContent = mainContent.replace(
      'const app = await NestFactory.create(AppModule);',
      `const app = await NestFactory.create(AppModule);\n  swagger(app);`,
    )

    await fs.writeFile(mainFilePath, mainContent, 'utf8')
  }

  // Create config directory
  private async createSwaggerConfig(projectPath: string) {
    const configDir = path.join(projectPath, 'src/config')
    await fs.ensureDir(configDir)

    const swaggerConfigContent = `import { INestApplication } from '@nestjs/common'
    import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
    
    // Swagger API Document
    export const swagger = (app: INestApplication) => {
      const config = new DocumentBuilder()
        .setTitle('Kaput API')
        .setVersion('0.1.0')
        .addBearerAuth()
        .build()
    
      const document = SwaggerModule.createDocument(app, config, {
        extraModels: [],
      })
    
      SwaggerModule.setup('/swagger', app, document)
    }
`

    await fs.writeFile(
      path.join(configDir, 'swagger.config.ts'),
      swaggerConfigContent,
    )
  }
}
