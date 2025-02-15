import { Body, Controller, Post, UseInterceptors } from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from '@blazity/nest-file-fastify'
import { FileUploadDto } from '@/user-role/user-role-permission.dto'
import { UserRolePermissionService } from '@/user-role/user-role-permission.service'

@ApiTags('User Role')
@Controller('user-role')
export class UserRolePermissionController {
  constructor(private userRolePermissionService: UserRolePermissionService) {}

  @Post()
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: MemoryStorageFile,
    @Body() body: FileUploadDto,
  ) {
    return this.userRolePermissionService.processCSV(file)
  }
}
