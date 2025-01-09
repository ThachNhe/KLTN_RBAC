import { Module } from '@nestjs/common'
import { UserRolePermissionController } from './user-role-permission.controller'
import { UserRolePermissionService } from './user-role-permission.service'
import { DatabaseModule } from '@/database/database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [UserRolePermissionController],
  providers: [UserRolePermissionService],
})
export class UserRolePermissionModule {}
