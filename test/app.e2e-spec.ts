import { INestApplication } from '@nestjs/common'
import supertest from 'supertest'
import TestAgent from 'supertest/lib/agent'
import { closeApp, initApp } from './utils'

describe('AppController (e2e)', () => {
  let app: INestApplication
  let httpClient: TestAgent

  beforeAll(async () => {
    app = await initApp()
    httpClient = supertest(app.getHttpServer())
  })

  afterAll(() => {
    closeApp()
  })

  it('[GET] /', async () => {
    const res = await httpClient.get('/').expect(200)
    expect(res.body.status).toBe('OK')
  })

  it('[GET] /healthz', async () => {
    const res = await httpClient.get('/healthz').expect(200)
    expect(res.body.status).toBe('ok')
  })
})
