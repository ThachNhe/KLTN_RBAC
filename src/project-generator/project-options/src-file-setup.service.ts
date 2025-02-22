import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class SrcFileSetupService {
  private readonly logger = new Logger(SrcFileSetupService.name)

  async setup(projectPath: string): Promise<void> {
    try {
      await this.createEnvironmentFiles(projectPath)

      this.updateTsConfig(projectPath)

      await this.updateESLintConfig(projectPath)

      this.logger.debug('Auth setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup auth: ${error.message}`)
      throw error
    }
  }
  public createDockerFeatures(projectPath: string) {
    this.createDockerFile(projectPath)
    this.createDockerComposeFile(projectPath)
  }

  private updateTsConfig(projectPath: string) {
    const tsConfigPath = path.join(projectPath, 'tsconfig.json')
    const tsConfig = fs.readJsonSync(tsConfigPath)
    tsConfig.compilerOptions.paths = {
      '@/*': ['src/*'],
    }

    fs.writeJsonSync(tsConfigPath, tsConfig, { spaces: 2 })
  }

  private async createDockerFile(projectPath: string) {
    const srcDir = path.join(projectPath, 'src')
    fs.ensureDirSync(srcDir)

    const dockerFileContent = `FROM node:20
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn
COPY . .
CMD ["./bin/dev.sh"]
`
    fs.writeFileSync(path.join(projectPath, 'Dockerfile'), dockerFileContent)
  }

  private createDockerComposeFile(projectPath: string) {
    const srcDir = path.join(projectPath, 'src')
    fs.ensureDirSync(srcDir)
    const dockerComposeContent = `services:
  postgres:
    image: postgres:16.3-alpine
    environment:
      POSTGRES_USER: ${`DB_USER`}
      POSTGRES_PASSWORD: ${`DB_PASS`}
      POSTGRES_DB_MAIN: ${`DB_MAIN`}
      POSTGRES_DB_TEST: ${`DB_TEST`}
      PGDATA: /var/lib/postgresql/data/pgdata
    ports:
      - ${`DB_PORT`}:5432
    volumes:
      - pg_data:/var/lib/postgresql/data/pgdata
      - ./init-db.sh:/docker-entrypoint-initdb.d/init-db.sh
    networks:
      - backend

  mailpit:
    image: axllent/mailpit
    ports:
      - 8025:8025
      - 1025:1025
    networks:
      - backend

volumes:
  pg_data:

    `
    fs.writeFileSync(
      path.join(projectPath, 'docker-compose.yml'),
      dockerComposeContent,
    )
  }

  private async createEnvironmentFiles(projectPath) {
    // Create .env and .env.example files
    const envContent = `NODE_ENV=development
`
    await fs.writeFile(path.join(projectPath, '.env'), envContent)
    await fs.writeFile(path.join(projectPath, '.env.example'), envContent)
  }

  private async updateESLintConfig(projectPath: string) {
    const eslintConfigPath = path.join(projectPath, '.eslintrc.js')

    console.log('eslintConfigPath', eslintConfigPath)

    const eslintConfig = require(eslintConfigPath)

    console.log('eslintConfig', eslintConfig)
    eslintConfig.rules = {
      ...eslintConfig.rules,
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    }

    fs.writeJsonSync(eslintConfigPath, eslintConfig, { spaces: 2 })
  }
}
