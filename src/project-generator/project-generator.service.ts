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
      // Read package.json
      const packageJsonPath = path.join(projectPath, 'package.json')
      const packageJson = await fs.readJson(packageJsonPath)

      // Customize package.json
      packageJson.description = options.description || packageJson.description

      // Write back package.json
      await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
    } catch (error) {
      this.logger.error(`Failed to customize project: ${error.message}`)
      throw error
    }
  }

  private async createZipFromDirectory(dirPath: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        // Khởi tạo archive trước
        const archive = archiver('zip', {
          zlib: { level: 9 },
        })

        const chunks: any[] = []

        // Thêm event listeners
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

        // Thêm files vào archive
        archive.directory(dirPath, false)

        // Finalize sau khi đã setup xong
        archive.finalize()
      } catch (error) {
        reject(error)
      }
    })
  }
}
