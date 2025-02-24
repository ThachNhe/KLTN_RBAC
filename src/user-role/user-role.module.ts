import { Module } from '@nestjs/common'
import { UserRoleController } from './user-role.controller'
import { UserRoleService } from './user-role.service'
import { DatabaseModule } from '@/database/database.module'

@Module({
  imports: [DatabaseModule],
  controllers: [UserRoleController],
  providers: [UserRoleService],
})
export class UserRoleModule {}
