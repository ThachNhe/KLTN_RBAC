import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class SharedSetupService {
  private readonly logger = new Logger(SharedSetupService.name)

  async setup(projectPath: string): Promise<void> {
    try {
      const SharedDir = path.join(projectPath, 'src/shared')
      fs.ensureDirSync(SharedDir)

      this.createUtilFile(SharedDir)
      await this.updateDependencies(projectPath)

      this.logger.debug('Auth setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup auth: ${error.message}`)
      throw error
    }
  }

  public async createOrmModuleFile(projectPath: string) {
    const SharedDir = path.join(projectPath, 'src/shared')
    fs.ensureDirSync(SharedDir)

    const ormModuleContent = `import { User } from '@/db/entities';
import dbConfig from '@/config/mikro-orm.config';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Global, Module } from '@nestjs/common';

@Global()
@Module({
  imports: [
    MikroOrmModule.forRoot(dbConfig),
    MikroOrmModule.forFeature({
      entities: [User],
    }),
  ],
  exports: [MikroOrmModule],
})
export class OrmModule {}

`
    fs.writeFileSync(path.join(SharedDir, 'orm.module.ts'), ormModuleContent)
  }

  private async createUtilFile(SharedDir: string) {
    const utilFileContent = `import 'dotenv/config';

import { Snowyflake } from 'snowyflake';

const snowyflake = new Snowyflake({
  workerId: BigInt(process.env.WORKER_ID || '1'),
  epoch: 1577836800000n, // 2020-01-01 00:00:00 GMT
  // epoch: Epoch.Twitter,
});

export const genId = () => snowyflake.nextId().toString();

export const decodeId = (id: string) => snowyflake.deconstruct(BigInt(id));

export const genReqId = (req: any) => req.headers['x-request-id'] || genId();
`
    fs.writeFileSync(path.join(SharedDir, 'util.ts'), utilFileContent)
  }

  private async updateDependencies(projectPath: string) {
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = fs.readJsonSync(packageJsonPath)

    packageJson.dependencies = {
      ...packageJson.dependencies,
      snowyflake: '^2.0.0',
    }

    fs.writeJsonSync(packageJsonPath, packageJson, { spaces: 2 })
  }
}
