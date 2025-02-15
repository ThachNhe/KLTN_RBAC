import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class AuthServiceSetup {
  private readonly logger = new Logger(AuthServiceSetup.name)

  async setup(projectPath: string): Promise<void> {
    try {
      this.updateDependencies(projectPath)

      this.createAuthModule(projectPath)

      this.createUsersModule(projectPath)

      this.updateAppModule(projectPath)

      this.createEnvironmentFiles(projectPath)

      this.logger.debug('Auth setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup auth: ${error.message}`)
      throw error
    }
  }

  private async updateDependencies(projectPath: string) {
    // Add dependencies to package.json
    const packageJsonPath = path.join(projectPath, 'package.json')
    const packageJson = await fs.readJson(packageJsonPath)

    // Add auth dependencies
    packageJson.dependencies = {
      ...packageJson.dependencies,
      '@nestjs/jwt': '^10.0.0',
      '@nestjs/passport': '^10.0.0',
      passport: '^0.6.0',
      'passport-jwt': '^4.0.1',
      bcrypt: '^5.1.0',
      'class-validator': '^0.14.0',
      'class-transformer': '^0.5.1',
    }

    packageJson.devDependencies = {
      ...packageJson.devDependencies,
      '@types/passport-jwt': '^3.0.8',
      '@types/bcrypt': '^5.0.0',
    }

    await fs.writeJson(packageJsonPath, packageJson, { spaces: 2 })
  }

  private async createAuthModule(projectPath: string) {
    // Create auth module
    const authDir = path.join(projectPath, 'src/auth')
    const strategiesDir = path.join(authDir, 'strategies')
    const guardsDir = path.join(authDir, 'guards')
    const decoratorsDir = path.join(authDir, 'decorators')
    const dtoDir = path.join(authDir, 'dto')

    await fs.ensureDir(authDir)
    await fs.ensureDir(strategiesDir)
    await fs.ensureDir(guardsDir)
    await fs.ensureDir(decoratorsDir)
    await fs.ensureDir(dtoDir)

    // auth.module.ts
    const authModuleContent = `import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '1h' },
    }),
    UsersModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
`

    const authInterfaceContent = `import { Request } from 'express'

import { User } from '@/db/entities'

export interface AuthRequest extends Request {
  user: User
}

`

    // auth.service.ts
    const authServiceContent = `import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from '../users/users.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
  ) {}

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.usersService.findByEmail(email);
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }

  async getAuthUser(user: User) {
    const accessToken = this.getAccessToken(
      user.id,
      user.role.name,
      user.email,
      '1d',
    );
    const refreshToken = this.getAccessToken(
      user.id,
      user.role.name,
      user.email,
      '30d',
    );

    return { ...user, accessToken, refreshToken };
  }

  getAccessToken(
    userId: string,
    role: string,
    email: string,
    expiresIn: string | number = '30m',
  ) {
    return this.jwtService.sign(
      {
        sub: userId,
        role,
        email,
      },
      { expiresIn },
    );
  }

  async login(user: any) {
    const payload = { email: user.email, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}
`

    // auth.controller.ts
    const authControllerContent = `import { Controller, Post, Request, UseGuards } from '@nestjs/common';

import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { LoginDto } from './dto/auth.dto';
import { LocalAuthGuard } from './guards/jwt-auth.guard';
import { AuthRequest } from '.dto/auth.interface';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Return JWT token' })
  @ApiBody({ type: LoginDto })
  @UseGuards(LocalAuthGuard)
  async login(@Request() req: AuthRequest) {
    this.authService.getAuthUser(req.user);
  }
}

`
    // local.strategy.ts
    const localStrategyContent = `import { Strategy } from 'passport-local'
import { Injectable, UnauthorizedException } from '@nestjs/common'
import { PassportStrategy } from '@nestjs/passport'

import { AuthService } from './auth.service'

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super()
  }

  async validate(username: string, password: string){
    const user = await this.authService.validateUser(username, password)
    if (!user) {
      throw new UnauthorizedException()
    }
    return user
  }
}
`

    // jwt.strategy.ts
    const jwtStrategyContent = `import { ExtractJwt, Strategy } from 'passport-jwt'
import { PassportStrategy } from '@nestjs/passport'
import { Injectable } from '@nestjs/common'

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        ExtractJwt.fromUrlQueryParameter('token'),
      ]),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret',
    })
  }

  async validate(payload: any) {
    return { id: payload.sub, role: payload.role, email: payload.email }
  }
}
`

    // jwt-auth.guard.ts
    const jwtAuthGuardContent = `import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}

export class LocalAuthGuard extends AuthGuard('local') {}`

    // current-user.decorator.ts
    const currentUserDecoratorContent = `
import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);`

    // login.dto.ts
    const loginDtoContent = `import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty } from 'class-validator';
export class LoginDto {
  @ApiProperty()
  @IsEmail()
  @IsNotEmpty()
  username: string;
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string;
}
          `

    // Write files
    await fs.writeFile(path.join(authDir, 'auth.module.ts'), authModuleContent)
    await fs.writeFile(
      path.join(authDir, 'auth.service.ts'),
      authServiceContent,
    )

    await fs.writeFile(
      path.join(authDir, 'dto', 'auth.interface.ts'),
      authInterfaceContent,
    )

    await fs.writeFile(
      path.join(authDir, 'auth.controller.ts'),
      authControllerContent,
    )

    await fs.writeFile(
      path.join(strategiesDir, 'local.strategy.ts'),
      localStrategyContent,
    )

    await fs.writeFile(
      path.join(strategiesDir, 'jwt.strategy.ts'),
      jwtStrategyContent,
    )
    await fs.writeFile(
      path.join(guardsDir, 'jwt-auth.guard.ts'),
      jwtAuthGuardContent,
    )
    await fs.writeFile(
      path.join(decoratorsDir, 'current-user.decorator.ts'),
      currentUserDecoratorContent,
    )

    await fs.writeFile(
      path.join(authDir, 'dto', 'auth.dto.ts'),
      loginDtoContent,
    )
  }

  private async createUsersModule(projectPath) {
    // Create users module
    const usersDir = path.join(projectPath, 'src/users')
    await fs.ensureDir(usersDir)

    // users.module.ts
    const usersModuleContent = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}`

    // user.entity.ts
    const userEntityContent = `
import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  firstName: string;

  @Column({ nullable: true })
  lastName: string;
}`

    // users.service.ts
    const usersServiceContent = `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  async findOne(id: number): Promise<User> {
    return this.usersRepository.findOneBy({ id });
  }

  async findByEmail(email: string): Promise<User> {
    return this.usersRepository.findOneBy({ email });
  }
}`

    await fs.writeFile(
      path.join(usersDir, 'users.module.ts'),
      usersModuleContent,
    )
    await fs.writeFile(path.join(usersDir, 'user.entity.ts'), userEntityContent)
    await fs.writeFile(
      path.join(usersDir, 'users.service.ts'),
      usersServiceContent,
    )
  }

  private async updateAppModule(projectPath: string) {
    // Update app.module.ts
    const appModulePath = path.join(projectPath, 'src/app.module.ts')
    let appModuleContent = await fs.readFile(appModulePath, 'utf8')

    // Add import
    const authImport = `import { AuthModule } from './auth/auth.module';\n`
    appModuleContent = authImport + appModuleContent

    // Add AuthModule to imports
    appModuleContent = appModuleContent.replace(
      'imports: [',
      'imports: [AuthModule, ',
    )

    await fs.writeFile(appModulePath, appModuleContent)
  }
  private async createEnvironmentFiles(projectPath) {
    // Create .env and .env.example files
    const envContent = `
JWT_SECRET=your-secret-key
JWT_EXPIRATION=1h`

    await fs.writeFile(path.join(projectPath, '.env'), envContent)
    await fs.writeFile(path.join(projectPath, '.env.example'), envContent)
  }
}
