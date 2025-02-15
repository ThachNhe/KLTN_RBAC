import { Body, Controller, Get, Post, UseInterceptors } from '@nestjs/common'
import { RolePermissionService } from './role-permission.service'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import { permissionCheckDto } from '@/role-permission/role.permssion.dto'
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from '@blazity/nest-file-fastify'
import { FileUploadDto } from '@/user-role/user-role-permission.dto'

@Controller('role-permission')
@ApiTags('Role Permission')
export class RolePermissionController {
  constructor(private readonly rolePermissionService: RolePermissionService) {}

  @Post('check')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: MemoryStorageFile,
    @Body() body: FileUploadDto,
  ) {
    if (!file) {
      throw new Error('File not found')
    }
    // Read file content from memory storage
    const xmlData = file.buffer.toString('utf8')

    return this.rolePermissionService.checkProjectPermissions(xmlData)
  }

  @Get()
  async getRolePermissions() {
    return 'OKOK'
  }
}
