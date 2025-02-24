import { LoggerModule } from 'nestjs-pino'
import { loggerConfig } from '@/app.config'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TerminusModule } from '@nestjs/terminus'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from './database/database.module'
import { UserRoleModule } from './user-role/user-role.module'
import { ProjectGeneratorModule } from './project-generator/project-generator.module'
import { RolePermissionModule } from '@/role-permission/role-permission.module'
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot(loggerConfig),
    TerminusModule,
    DatabaseModule,
    UserRoleModule,
    ProjectGeneratorModule,
    RolePermissionModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
