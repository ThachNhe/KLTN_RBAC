import { LoggerModule } from 'nestjs-pino'
import { loggerConfig } from '@/app.config'
import { Module } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { TerminusModule } from '@nestjs/terminus'
import { AppController } from './app.controller'
import { AppService } from './app.service'
import { DatabaseModule } from './database/database.module'
import { UserRolePermissionModule } from './user-role-permission/user-role-permission.module'
import { ProjectGeneratorModule } from './project-generator/project-generator.module';
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    LoggerModule.forRoot(loggerConfig),
    TerminusModule,
    DatabaseModule,
    UserRolePermissionModule,
    ProjectGeneratorModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
