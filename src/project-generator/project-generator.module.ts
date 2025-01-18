import { Module } from '@nestjs/common';
import { ProjectGeneratorController } from './project-generator.controller';
import { ProjectGeneratorService } from './project-generator.service';

@Module({
  controllers: [ProjectGeneratorController],
  providers: [ProjectGeneratorService]
})
export class ProjectGeneratorModule {}
