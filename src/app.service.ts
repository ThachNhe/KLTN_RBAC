import { Injectable } from '@nestjs/common'
import { HealthCheckService, MikroOrmHealthIndicator } from '@nestjs/terminus'
import { PinoLogger } from 'nestjs-pino'

@Injectable()
export class AppService {
  constructor(
    private logger: PinoLogger,
    private health: HealthCheckService,
    private db: MikroOrmHealthIndicator,
  ) {
    this.logger.setContext(AppService.name)
  }

  getHello() {
    return {
      status: 'OK',
    }
  }

  healthCheck() {
    return this.health.check([() => this.db.pingCheck('database')])
  }
}
