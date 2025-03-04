import { Global, Module } from '@nestjs/common'
import { LlmService } from './llm.service'
import { LlmController } from './llm.controller'
import { ConfigModule } from '@nestjs/config'
import { HttpModule } from '@nestjs/axios'

@Global()
@Module({
  imports: [ConfigModule.forRoot(), HttpModule],
  providers: [LlmService],
  controllers: [LlmController],
  exports: [LlmService],
})
export class LlmModule {}
