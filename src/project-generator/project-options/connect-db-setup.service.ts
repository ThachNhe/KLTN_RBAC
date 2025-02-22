import { SrcFileSetupService } from './src-file-setup.service'
import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'
import { SharedSetupService } from '@/project-generator/project-options/shared-setup.service'

@Injectable()
export class ConnectDbSetupService {
  private readonly logger = new Logger(ConnectDbSetupService.name)
  private readonly sharedSetupService = new SharedSetupService()

  private readonly srcFileSetupService = new SrcFileSetupService()

  async setup(projectPath: string): Promise<void> {
    try {
      await this.updateDependencies(projectPath)

      await this.addMikroORMConfig(projectPath)

      await this.sharedSetupService.createOrmModuleFile(projectPath)

      this.srcFileSetupService.createDockerFeatures(projectPath)

      await this.createDBModule(projectPath)

      await this.updateAppModule(projectPath)

      await this.updateEnvironmentFiles(projectPath)

      this.logger.debug('Auth setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup auth: ${error.message}`)
      throw error
    }
  }

  private async updateDependencies(projectPath: string) {
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = await fs.readJson(packageJsonPath)

    packageJson.dependencies = {
      ...packageJson.dependencies,
      '@mikro-orm/core': '^6.3.13',
      '@mikro-orm/postgresql': '^6.3.13',
      '@faker-js/faker': '^9.0.3',
      '@mikro-orm/seeder': '^6.3.13',
      '@mikro-orm/nestjs': '6.0.2',
    }

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      '@nestjs/cli': '^10.4.5',
      '@types/passport-jwt': '^4.0.1',
      '@types/bcrypt': '^5.0.2',
    }

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
  }

  private async createDBModule(projectPath: string) {
    // Create auth module
    const dbDir = path.join(projectPath, 'src/db')
    const entitiesDir = path.join(dbDir, 'entities')
    const factoryDir = path.join(dbDir, 'factories')
    const seedDir = path.join(dbDir, 'seeds')

    await fs.ensureDir(dbDir)
    fs.ensureDirSync(entitiesDir)
    fs.ensureDirSync(factoryDir)
    fs.ensureDirSync(seedDir)

    // user.entity.ts
    const userEntityContent = `import { genId } from '@/shared/util';
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { Exclude } from 'class-transformer';

@Entity({ tableName: 'users' })
export class User {
  @PrimaryKey({ type: 'bigint' })
  @ApiProperty()
  id: string = genId();

  @Property()
  @ApiProperty()
  public email: string;

  @Property({ nullable: true })
  @ApiProperty()
  public phoneNumber?: string;

  @Exclude()
  @Property({ hidden: true })
  @Property()
  @ApiProperty()
  public password: string;

  @Property({ nullable: true })
  @ApiProperty()
  public firstName: string;

  @Property({ nullable: true })
  @ApiProperty()
  public lastName: string;

  @Property({ type: 'timestamp' })
  @ApiProperty()
  createdAt: Date = new Date();

  @Property({ type: 'timestamp', onUpdate: () => new Date() })
  @ApiProperty()
  updatedAt: Date = new Date();
}


`
    const entityIndexContent = `export * from './user.entity'`

    // user.factory.ts
    const userFactoryContent = `import { User } from '@/db/entities';
import { genId } from '@/shared/util';
import { faker } from '@faker-js/faker';
import { Factory } from '@mikro-orm/seeder';
import * as bcrypt from 'bcrypt';
export class UserFactory extends Factory<User> {
  model = User;

  definition(): Partial<User> {
    return {
      id: genId(),
      email: faker.internet.email(),
      phoneNumber: faker.phone.number(),
      password: bcrypt.hashSync('Pass@123', 10),
      firstName: faker.person.firstName(),
      lastName: faker.person.lastName(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}
`
    const factoryIndexContent = `export * from './user.factory'`

    const userSeedContent = `import { UserFactory } from '@/db/factories';
import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';

export class UserSeeder extends Seeder {
  async run(em: EntityManager) {
    new UserFactory(em).make(1, {
      email: 'admin@example.com',
    });

    new UserFactory(em).make(1, {
      email: 'user@example.com',
    });

    new UserFactory(em).make(10, {});
  }
}
`
    const seedIndexContent = `export * from './user.seed'`

    await fs.writeFile(
      path.join(entitiesDir, 'user.entity.ts'),
      userEntityContent,
    )

    await fs.writeFile(path.join(entitiesDir, 'index.ts'), entityIndexContent)

    await fs.writeFile(
      path.join(factoryDir, 'user.factory.ts'),
      userFactoryContent,
    )

    await fs.writeFile(path.join(factoryDir, 'index.ts'), factoryIndexContent)

    await fs.writeFile(path.join(seedDir, 'user.seed.ts'), userSeedContent)

    await fs.writeFile(path.join(seedDir, 'index.ts'), seedIndexContent)
  }

  private async addMikroORMConfig(projectPath: string) {
    const srcDir = path.join(projectPath, 'src')
    const configDir = path.join(srcDir, 'config')
    const mikroORMConfigContent = `import { Options } from '@mikro-orm/core';
import { defineConfig } from '@mikro-orm/postgresql';
import { configDotenv } from 'dotenv';
configDotenv();
const {
  NODE_ENV = 'development',
  DB_HOST,
  DB_PORT,
  DB_MAIN,
  DB_TEST,
  DB_USER,
  DB_PASS,
} = process.env;

const isTest = NODE_ENV === 'test';
const isDev = NODE_ENV === 'development';

const dbConfig: Options = defineConfig({
  host: DB_HOST,
  port: Number(DB_PORT),
  dbName: isTest ? DB_TEST : DB_MAIN,
  user: DB_USER,
  password: DB_PASS,
  discovery: { warnWhenNoEntities: false },
  debug: isDev ? true : false,
  allowGlobalContext: true,
  pool: {
    min: 0,
  },
  entities: ['./dist/db/entities/*.js'],
  entitiesTs: ['./src/db/entities/*.ts'],
  migrations: {
    path: './dist/db/migrations',
    pathTs: './src/db/migrations',
  },
  seeder: {
    path: './dist/db/seeders',
    pathTs: './src/db/seeders',
  },
});

export default dbConfig;
`

    await fs.ensureDir(configDir)
    await fs.writeFile(
      path.join(configDir, 'mikro-orm.config.ts'),
      mikroORMConfigContent,
    )
  }

  private async updateAppModule(projectPath: string) {
    // Update app.module.ts
    const appModulePath = path.join(projectPath, 'src/app.module.ts')
    let appModuleContent = await fs.readFile(appModulePath, 'utf8')

    // Add import
    const authImport = `import { OrmModule } from '@/shared/orm.module'\n`
    appModuleContent = authImport + appModuleContent

    // Add AuthModule to imports
    appModuleContent = appModuleContent.replace(
      'imports: [',
      'imports: [OrmModule, ',
    )

    await fs.writeFile(appModulePath, appModuleContent)
  }

  private async updateEnvironmentFiles(projectPath) {
    // Create .env and .env.example files
    const envContent = `DB_USER=root
DB_PASS=123
DB_MAIN=main_db
DB_TEST=test_db
DB_PORT=5432
DB_HOST=localhost
`
    await fs.writeFile(path.join(projectPath, '.env'), envContent)
    await fs.writeFile(path.join(projectPath, '.env.example'), envContent)
  }
}
