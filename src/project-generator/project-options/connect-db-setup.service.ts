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

      await this.createInitDBScript(projectPath)

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
      '@mikro-orm/migrations': '^6.4.7',
    }

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      '@nestjs/cli': '^10.4.5',
      '@types/passport-jwt': '^4.0.1',
      '@types/bcrypt': '^5.0.2',
      '@mikro-orm/cli': '^6.4.7',
    }

    packageJson.scripts = {
      ...packageJson.scripts,
      'db:up': 'mikro-orm migration:up',
      'db:migrate': 'mikro-orm schema:drop && mikro-orm migration:create',
      'db:fresh': 'mikro-orm migration:fresh',
      'db:seed': 'mikro-orm migration:fresh --seed',
      'db:test': 'NODE_ENV=test mikro-orm migration:fresh --seed',
    }

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
  }

  private async createDBModule(projectPath: string) {
    // Create auth module
    const dbDir = path.join(projectPath, 'src/db')
    const entitiesDir = path.join(dbDir, 'entities')
    const factoryDir = path.join(dbDir, 'factories')
    const seedDir = path.join(dbDir, 'seeders')

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

    const roleEntityContent = `import {
  Entity,
  PrimaryKey,
  Property,
  ManyToMany,
  Collection,
} from '@mikro-orm/core';
import { ApiProperty } from '@nestjs/swagger';
import { User } from './User';

@Entity({ tableName: 'roles' })
export class Role {
  @PrimaryKey({ type: 'bigint' })
  @ApiProperty()
  id: number;

  @Property()
  @ApiProperty()
  name: string;

  @Property({ nullable: true })
  @ApiProperty()
  description?: string;

  @ManyToMany(() => User, (user) => user.roles)
  @ApiProperty({ type: () => [User] })
  users = new Collection<User>(this);
}
`

    const entityIndexContent = `export * from './user.entity'\n
    export * from './role.entity'`

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
    // role.factory.ts
    const roleFactoryContent = `import { faker } from '@faker-js/faker';
import { Factory } from '@mikro-orm/seeder';
import { Role } from '../entities/Role';

export class RoleFactory extends Factory<Role> {
  model = Role;

  definition(): Partial<Role> {
    return {
      name: faker.helpers.arrayElement([
        'Admin',
        'User',
        'Manager',
        'Moderator',
      ]),
      description: faker.lorem.sentence(),
    };
  }
}
`

    const factoryIndexContent = `export * from './user.factory'\n
    export * from './role.factory'`

    // user.seed.ts
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
    // role.seed.ts
    const roleSeedContent = `import type { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { RoleFactory } from '../factories/role.factory';

export class RoleSeeder extends Seeder {
  async run(em: EntityManager) {
    new RoleFactory(em).make(1, {
      name: 'Admin',
    });

    new RoleFactory(em).make(1, {
      name: 'User',
    });

    new RoleFactory(em).make(1, {
      name: 'Manager',
    });

    new RoleFactory(em).make(1, {
      name: 'Moderator',
    });
    //  new RoleFactory(em).make(10, {});
  }
}
`
    const seedIndexContent = `export * from './user.seed'\n
    export * from './role.seed'`

    const dbSeeder = `import { UserSeeder } from './UserSeeder';
import { EntityManager } from '@mikro-orm/core';
import { Seeder } from '@mikro-orm/seeder';
import { RoleSeeder } from './RoleSeeder';

export class DatabaseSeeder extends Seeder {
  run(em: EntityManager) {
    return this.call(em, [RoleSeeder, UserSeeder]);
  }
}
`

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

    await fs.writeFile(
      path.join(entitiesDir, 'role.entity.ts'),
      roleEntityContent,
    )

    await fs.writeFile(
      path.join(factoryDir, 'role.factory.ts'),
      roleFactoryContent,
    )

    await fs.writeFile(path.join(seedDir, 'role.seed.ts'), roleSeedContent)

    await fs.writeFile(path.join(dbDir, 'DatabaseSeeder.ts'), dbSeeder)
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
DB_MAIN=postgres-db
DB_TEST=postgres-test
DB_PORT=4000
DB_HOST=localhost
POSTGRES_USER=root
POSTGRES_DB_MAIN=postgres-db
POSTGRES_DB_TEST=postgres-test
`
    await fs.writeFile(path.join(projectPath, '.env'), envContent)
    await fs.writeFile(path.join(projectPath, '.env.example'), envContent)
  }

  private async createInitDBScript(projectPath: string) {
    const initDbContent = `psql -v --username "\${POSTGRES_USER}" -c "CREATE DATABASE \${POSTGRES_DB_MAIN};"
psql -v --username "\${POSTGRES_USER}" -c "CREATE DATABASE \${POSTGRES_DB_TEST};"`

    await fs.writeFile(path.join(projectPath, 'init-db.sh'), initDbContent)
  }
}
