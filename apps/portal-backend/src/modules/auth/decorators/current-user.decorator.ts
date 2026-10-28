import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { Role } from '../../../common/enums/role.enum.js';

export interface AuthUser {
  id: string;
  email: string;
  tenantId: string;
  teamId: string;
  role: Role;
}

export const CurrentUser = createParamDecorator(
  (data: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<Request>();
    const user = (request as Request & { user?: AuthUser }).user;
    if (!user) {
      return undefined;
    }
    return data ? user[data] : user;
  },
);
