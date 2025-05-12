import { Controller, Post, UseInterceptors, Body } from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  FileFieldsInterceptor,
  MemoryStorageFile,
  UploadedFiles,
} from '@blazity/nest-file-fastify'
import { RolePermissionService } from './role-permission.service'
import { RolePermissionFileUploadDto } from '@/role-permission/role.permssion.dto'

@Controller('role-permission')
@ApiTags('Role Permission')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Post('check')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'file', maxCount: 1 },
      { name: 'projectFile', maxCount: 1 },
    ]),
  )
  async uploadFiles(
    @UploadedFiles()
    files: { file: MemoryStorageFile; projectFile: MemoryStorageFile },
    @Body() body: RolePermissionFileUploadDto,
  ) {
    if (!files.file || !files.projectFile) {
      throw new Error('Both XML and NestJS project files are required')
    }

    const xmlFileData = files.file[0].buffer.toString('utf8')
    // console.log('XML File Data:', xmlFileData)

    const nestJsZipData = files.projectFile[0].buffer

    return this.rolePermissionService.checkRolePermissionViolation(
      xmlFileData,
      nestJsZipData,
    )
  }
}
