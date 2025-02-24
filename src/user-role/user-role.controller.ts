import { Body, Controller, Post, UseInterceptors } from '@nestjs/common'
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger'
import {
  FileInterceptor,
  MemoryStorageFile,
  UploadedFile,
} from '@blazity/nest-file-fastify'
import { FileUploadDto } from '@/user-role/user-role.dto'
import { UserRoleService } from '@/user-role/user-role.service'

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
    return this.userRolePermissionService.check(file)
  }
}
