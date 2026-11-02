import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Role } from '../../../common/enums/role.enum.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';
import { ROLES_KEY } from '../decorators/roles.decorator.js';

const ROLE_RANK: Record<Role, number> = {
  [Role.SYSTEM]: 3,
  [Role.TEAM_ADMIN]: 2,
  [Role.MEMBER]: 1,
};

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    const user = request.user;
    if (!user) {
      return false;
    }
    const userRank = ROLE_RANK[user.role] ?? 0;
    return requiredRoles.some((role) => userRank >= (ROLE_RANK[role] ?? 0));
  }
}
