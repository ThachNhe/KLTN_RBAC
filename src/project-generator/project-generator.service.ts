import { Injectable, Logger } from '@nestjs/common'
import { exec } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import archiver = require('archiver')
import { ProjectOptions } from '@/project-generator/project-generator.interface'

@Injectable()
export class ProjectGeneratorService {
  private readonly logger = new Logger(ProjectGeneratorService.name)

  async generateProjectZip(options: ProjectOptions): Promise<Buffer> {
    const tempDir = path.join(process.cwd(), 'temp')
    const projectPath = path.join(tempDir, options.name)

    try {
      // Ensure temp directory exists
      await fs.ensureDir(tempDir)
      this.logger.debug(`Created temp directory at ${tempDir}`)

      // Generate project using NestJS CLI
      await this.executeNestNew(options, tempDir)
      this.logger.debug(`Project generated at ${projectPath}`)

      // Customize project if needed
      await this.customizeProject(projectPath, options)
      this.logger.debug('Project customization completed')

      // Create ZIP from the generated project
      const zipBuffer = await this.createZipFromDirectory(projectPath)
      this.logger.debug('Project ZIP created')

      // Cleanup
      await fs.remove(tempDir)
      this.logger.debug('Cleanup completed')

      return zipBuffer
    } catch (error) {
      this.logger.error(
        `Error generating project: ${error.message}`,
        error.stack,
      )
      // Ensure cleanup on error
      await fs
        .remove(tempDir)
        .catch((e) =>
          this.logger.error(`Cleanup failed: ${e.message}`, e.stack),
        )
      throw error
    }
  }

  private async executeNestNew(
    options: ProjectOptions,
    cwd: string,
  ): Promise<void> {
    const command = `nest new ${options.name} --package-manager ${options.packageManager} --skip-git --directory ${options.name} --skip-install`

    return new Promise((resolve, reject) => {
      exec(command, { cwd }, (error, stdout, stderr) => {
        if (error) {
          this.logger.error(`nest new command failed: ${error.message}`)
          this.logger.error(`stderr: ${stderr}`)
          reject(error)
          return
        }
        this.logger.debug(`nest new output: ${stdout}`)
        resolve()
      })
    })
  }

  private async customizeProject(
    projectPath: string,
    options: ProjectOptions,
  ): Promise<void> {
    try {
      // Customize package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageJson = await fs.readJson(packageJsonPath)
      packageJson.description = options.description || packageJson.description
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })

      // Set up Swagger if needed
      if (options.swagger) {
        await this.setupSwagger(projectPath)
        this.logger.debug('Swagger setup completed')
      }

      // Add message to README.md
      const readmePath = path.join(projectPath, 'README.md')
      let readmeContent = await fs.readFile(readmePath, 'utf8')

      if (options.swagger) {
        readmeContent += `\n\n## Swagger Documentation\n`
        readmeContent += `- Swagger UI is available at http://localhost:3000/api\n`
        readmeContent += `- Swagger JSON is available at http://localhost:3000/api-json\n`
      }

      await fs.writeFile(readmePath, readmeContent)
    } catch (error) {
      this.logger.error(`Failed to customize project: ${error.message}`)
      throw error
    }
  }

  private async createZipFromDirectory(dirPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Initialize archiver
        const archive = archiver('zip', {
          zlib: { level: 9 },
        })

        const chunks: any[] = []

        // Add listeners
        archive.on('data', (chunk) => chunks.push(chunk))
        archive.on('warning', (err) => {
          if (err.code === 'ENOENT') {
            this.logger.warn(`Warning while creating zip: ${err.message}`)
          } else {
            reject(err)
          }
        })
        archive.on('error', (err) => {
          this.logger.error(`Zip creation failed: ${err.message}`)
          reject(err)
        })
        archive.on('end', () => {
          this.logger.debug('Zip archive finalized successfully')
          resolve(Buffer.concat(chunks))
        })

        // Add directory to archive
        archive.directory(dirPath, false)

        // Finalize archive
        archive.finalize()
      } catch (error) {
        reject(error)
      }
    })
  }

  private async setupSwagger(projectPath: string): Promise<void> {
    try {
      // Get package.json
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

      // Create config directory
      const configDir = path.join(projectPath, 'src/config')
      await fs.ensureDir(configDir)

      const swaggerConfigContent = `
        import { DocumentBuilder } from '@nestjs/swagger';

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

      this.logger.debug('Swagger setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup swagger: ${error.message}`)
      throw error
    }
  }
}
