import { PolicySetupService } from './project-options/policy-setup.service'
import { Injectable, Logger } from '@nestjs/common'
import { exec } from 'child_process'
import * as fs from 'fs-extra'
import * as path from 'path'
import archiver = require('archiver')
import { ProjectOptions } from '@/project-generator/project-generator.interface'
import { SwaggerSetupService } from '@/project-generator/project-options/swagger-setup.service'
import { AuthServiceSetup } from '@/project-generator/project-options/auth-setup.service'
import { AuthorizationSetupService } from '@/project-generator/project-options/authorization-setup.service'

@Injectable()
export class ProjectGeneratorService {
  private readonly logger = new Logger(ProjectGeneratorService.name)
  private readonly swaggerSetupService = new SwaggerSetupService()
  private readonly authServiceSetup = new AuthServiceSetup()
  private readonly authorizationSetupService = new AuthorizationSetupService()
  private readonly policySetupService = new PolicySetupService()

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
        await this.swaggerSetupService.setup(projectPath)
        this.logger.debug('Swagger setup completed')
      }

      console.log('check option ===================', options)
      // Set up Auth if needed
      if (options.auth) {
        await this.authServiceSetup.setup(projectPath)
        this.logger.debug('Auth setup completed')
      }

      // Set up Authorization if needed
      await this.authorizationSetupService.setup(projectPath)

      const configXmlPath = './role-permission-config.xml'
      await this.policySetupService.setup(projectPath, configXmlPath)

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
}
