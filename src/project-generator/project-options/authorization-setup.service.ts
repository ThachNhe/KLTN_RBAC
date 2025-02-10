import { Injectable, Logger } from '@nestjs/common'
import * as fs from 'fs-extra'
import * as path from 'path'

@Injectable()
export class AuthorizationSetupService {
  private readonly logger = new Logger(AuthorizationSetupService.name)

  async setup(projectPath: string) {
    try {
      this.logger.log('Authorization setup started')

      // Create base directories
      const authDir = path.join(projectPath, 'src/auth')
      const decoratorsDir = path.join(authDir, 'decorators')
      const guardsDir = path.join(authDir, 'guards')

      // Ensure all directories exist
      await fs.ensureDir(decoratorsDir)
      await fs.ensureDir(guardsDir)

      // Create files
      await this.createRoleDecorator(decoratorsDir)
      await this.createRoleGuard(guardsDir)

      this.logger.log('Authorization setup completed')
    } catch (error) {
      this.logger.error(`Failed to setup authorization: ${error.message}`)
      throw error
    }
  }

  private async createRoleDecorator(decoratorsDir: string) {
    try {
      const roleDecoratorContent = `
import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
`
      const roleDecoratorPath = path.join(decoratorsDir, 'roles.decorator.ts')
      await fs.writeFile(roleDecoratorPath, roleDecoratorContent)
      this.logger.debug(`Created roles decorator at ${roleDecoratorPath}`)
    } catch (error) {
      this.logger.error(`Failed to create role decorator: ${error.message}`)
      throw error
    }
  }

  private async createRoleGuard(guardsDir: string) {
    try {
      const roleGuardContent = `
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
`
      const roleGuardPath = path.join(guardsDir, 'roles.guard.ts')
      await fs.writeFile(roleGuardPath, roleGuardContent)
      this.logger.debug(`Created roles guard at ${roleGuardPath}`)
    } catch (error) {
      this.logger.error(`Failed to create role guard: ${error.message}`)
      throw error
    }
  }
}
