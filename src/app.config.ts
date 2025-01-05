import 'dotenv/config'

import { HandlebarsAdapter } from '@nestjs-modules/mailer/dist/adapters/handlebars.adapter'
import { MailerOptions } from '@nestjs-modules/mailer/dist/interfaces/mailer-options.interface'
import { RequestMethod } from '@nestjs/common'
import { JwtModuleOptions } from '@nestjs/jwt'
import path from 'path'

const { NODE_ENV } = process.env

const isTest = NODE_ENV === 'test'
const isProd = NODE_ENV === 'production'

export const loggerConfig = {
  pinoHttp: {
    level: isProd ? 'info' : 'debug',
    transport: isProd
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            ignore: 'pid,hostname,context,req.headers',
            translateTime: `UTC:yyyy-mm-dd'T'HH:MM:ss'Z'`,
            messageFormat: `{if context}[{context}] {end}{msg}`,
            colorize: true,
            singleLine: true,
          },
        },
    autoLogging: isTest ? false : true,
    quietReqLogger: true,
  },
  exclude: [{ method: RequestMethod.ALL, path: '/healthz' }],
}

const { JWT_SECRET, JWT_TTL = '30m' } = process.env

export const jwtConfig: JwtModuleOptions = {
  global: true,
  secret: JWT_SECRET,
  signOptions: {
    expiresIn: JWT_TTL,
  },
}

const {
  MAIL_HOST = 'localhost',
  MAIL_PORT = '1025',
  MAIL_USERNAME,
  MAIL_PASSWORD,
  MAIL_FROM_ADDRESS,
  MAIL_FROM_NAME,
} = process.env

export const mailConfig: MailerOptions = {
  transport: {
    host: MAIL_HOST,
    port: Number(MAIL_PORT),
    secure: ['465', '587'].includes(MAIL_PORT),
    auth: {
      user: MAIL_USERNAME,
      pass: MAIL_PASSWORD,
    },
  },
  defaults: {
    from: `"${MAIL_FROM_NAME}" <${MAIL_FROM_ADDRESS}>`,
  },
  template: {
    dir: path.join(__dirname, 'mail/templates'),
    adapter: new HandlebarsAdapter(),
    options: {
      strict: true,
    },
  },
}
