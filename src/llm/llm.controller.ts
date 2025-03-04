import { Controller, Get } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { LlmService } from './llm.service'

@Controller('llm')
@ApiTags('LLM')
export class LlmController {
  constructor(private LlmService: LlmService) {}

  @Get('test')
  getHello() {
    // return this.LlmService.getResourceName('')
  }
}
