import { Logger } from 'nestjs-pino'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyMultipart from '@fastify/multipart'
import { AllExceptionFilter } from '@/shared/filters'
import { genReqId } from '@/shared/utils'
import { swagger } from '@/swagger'
import { AppModule } from './app.module'
import { ResponseInterceptor } from '@/shared/interceptors'

async function bootstrap() {
  // fastify
  const adapter = new FastifyAdapter({ logger: false, genReqId })

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    adapter,
  )

  const logger = app.get(Logger)
  const config = app.get(ConfigService)

  app.useLogger(logger)
  app.flushLogs()

  // Cookies
  // https://docs.nestjs.com/techniques/cookies
  await app.register(fastifyCookie, {
    secret: config.get('COOKIE_SECRET'),
  })

  await app.register(fastifyMultipart)

  app.enableCors({
    origin: true,
    credentials: true,
    exposedHeaders: ['set-cookie'],
  })

  // Auto-validation
  // https://docs.nestjs.com/techniques/validation#stripping-properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      stopAtFirstError: true,
    }),
  )

  // Exception Filter
  app.useGlobalFilters(new AllExceptionFilter(logger))
  app.useGlobalInterceptors(new ResponseInterceptor())

  swagger(app)

  app.enableShutdownHooks()

  const APP_PORT = config.get('APP_PORT', 8000)
  await app.listen(APP_PORT, '0.0.0.0', () => {
    logger.log(`Listening for HTTP on port ${APP_PORT}`)
  })

  const silentError = (err: any) => logger.error(err)
  process.on('unhandledRejection', silentError)
  process.on('uncaughtException', silentError)
}

bootstrap()
