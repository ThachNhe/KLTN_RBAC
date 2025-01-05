import { Controller, Get } from '@nestjs/common'

import { ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { AppService } from './app.service'

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private appService: AppService) {}

  @Get()
  @ApiOkResponse({
    description: 'Welcome API',
  })
  getHello() {
    return this.appService.getHello()
  }

  @Get('/health')
  @ApiOkResponse({
    description:
      'A health check is positive if all the assigned health indicators are up and running.',
  })
  healthCheck() {
    return this.appService.healthCheck()
  }
}
