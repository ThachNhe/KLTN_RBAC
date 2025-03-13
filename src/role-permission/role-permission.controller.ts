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
      { name: 'files', maxCount: 1 },
      { name: 'nestjsDir', maxCount: 1 },
    ]),
  )
  async uploadFiles(
    @UploadedFiles()
    files: { files: MemoryStorageFile; nestjsDir: MemoryStorageFile },
    @Body() body: RolePermissionFileUploadDto,
  ) {
    if (!files.files || !files.nestjsDir) {
      throw new Error('Both XML and NestJS project files are required')
    }

    const xmlFileData = files.files[0].buffer.toString('utf8')
    // console.log('XML File Data:', xmlFileData)

    const nestJsZipData = files.nestjsDir[0].buffer

    return this.rolePermissionService.checkProjectPermissions(
      xmlFileData,
      nestJsZipData,
    )
  }
}
