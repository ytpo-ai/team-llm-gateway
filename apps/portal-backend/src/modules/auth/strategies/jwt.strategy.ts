import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../../common/enums/role.enum.js';
import { TeamsService } from '../../teams/teams.service.js';
import { TenantService } from '../../tenant/tenant.service.js';
import type { JwtPayload } from '../auth.service.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly teamsService: TeamsService,
    private readonly tenantService: TenantService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthUser> {
    let tenantId = payload.tenantId;
    let teamId = payload.teamId;

    const requestedTenantId = req.headers['x-tenant-id'];
    if (
      payload.role === Role.SYSTEM &&
      typeof requestedTenantId === 'string' &&
      requestedTenantId.length > 0
    ) {
      const tenant = await this.tenantService.findByIdOrNull(requestedTenantId);
      if (tenant) {
        tenantId = String(tenant._id);
        const team =
          await this.teamsService.findFirstTeamForTenantOrNull(requestedTenantId);
        teamId = team ? String(team._id) : '';
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId,
      teamId,
      role: payload.role,
    };
  }
}
