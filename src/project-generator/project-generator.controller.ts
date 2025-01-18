import { Controller, Post, Body, Res, HttpStatus, Logger } from '@nestjs/common'
import { Response } from 'express'
import { ProjectGeneratorService } from './project-generator.service'
import { CreateProjectDto } from '@/project-generator/project-generator.dto'
import { ApiTags } from '@nestjs/swagger'

@ApiTags('Project Generator')
@Controller('api/project-generator')
export class ProjectGeneratorController {
  private readonly logger = new Logger(ProjectGeneratorController.name)

  constructor(
    private readonly projectGeneratorService: ProjectGeneratorService,
  ) {}

  @Post('create')
  async generateProject(
    @Body() createProjectDto: CreateProjectDto,
    @Res() response: Response,
  ) {
    try {
      this.logger.log(
        `Starting project generation for ${createProjectDto.name}`,
      )

      const zipBuffer =
        await this.projectGeneratorService.generateProjectZip(createProjectDto)

      // Set headers for the response
      response.header('Content-Type', 'application/zip')
      response.header(
        'Content-Disposition',
        `attachment; filename=${createProjectDto.name}.zip`,
      )
      this.logger.log(`Successfully generated project ${createProjectDto.name}`)
      // return zipBuffer.toString('base64')

      response.send(zipBuffer)
    } catch (error) {
      this.logger.error(
        `Failed to generate project: ${error.message}`,
        error.stack,
      )
      response.status(500).send({
        message: 'Failed to generate project',
        error: error.message,
      })
    }
  }
}
