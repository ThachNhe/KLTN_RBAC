import { FileUploadDto } from '@/user-role/user-role.dto'
import { UserRoleService } from '@/user-role/user-role.service'
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from '@blazity/nest-file-fastify'
import { Body, Controller, Post, UseInterceptors } from '@nestjs/common'
import { ApiConsumes, ApiTags } from '@nestjs/swagger'

@ApiTags('User Role')
@Controller('user-role')
export class UserRoleController {
  constructor(private userRolePermissionService: UserRoleService) {}

  @Post('check')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async checkUserRoleViolation(
    @UploadedFile() file: MemoryStorageFile,
    @Body() body: FileUploadDto,
  ) {
    return this.userRolePermissionService.checkUserRoleViolation(file)
  }
}
