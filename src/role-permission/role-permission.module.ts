import { Module } from '@nestjs/common'
import { RolePermissionController } from './role-permission.controller'
import { RolePermissionService } from './role-permission.service'
import { LlmModule } from '@/llm/llm.module'

@Module({
  imports: [LlmModule],
  controllers: [RolePermissionController],
  providers: [RolePermissionService],
})
export class RolePermissionModule {}
