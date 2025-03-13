import {
  Controller,
  Post,
  Body,
  Res,
  Logger,
  UseInterceptors,
} from '@nestjs/common'
import { Response } from 'express'
import { ProjectGeneratorService } from './project-generator.service'
import { CreateProjectDto } from '@/project-generator/project-generator.dto'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from '@blazity/nest-file-fastify'

@ApiTags('Project Generator')
@Controller('api/project-generator')
export class ProjectGeneratorController {
  private readonly logger = new Logger(ProjectGeneratorController.name)

  constructor(
    private readonly projectGeneratorService: ProjectGeneratorService,
  ) {}

  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  async generateProject(
    @Body() createProjectDto: CreateProjectDto,
    @UploadedFile() file: MemoryStorageFile,
    @Res() response: Response,
  ) {
    try {
      this.logger.log(
        `Starting project generation for ${createProjectDto.name}`,
      )
      let fileContent = ''
      if (file) {
        fileContent = file.buffer.toString('utf8')
      }

      const zipBuffer = await this.projectGeneratorService.generateProjectZip(
        createProjectDto,
        fileContent,
      )

      // Set headers for the response
      response.header('Content-Type', 'application/zip')
      response.header(
        'Content-Disposition',
        `attachment; filename=${createProjectDto.name}.zip`,
      )

      this.logger.log(`Successfully generated project ${createProjectDto.name}`)

      // Send the zip buffer as the response
      response.send(zipBuffer)
    } catch (error) {
      this.logger.error(
        `Failed to generate project: ${error.message}`,
        error.stack,
      )
      throw new Error('Failed to generate project')
    }
  }
}
