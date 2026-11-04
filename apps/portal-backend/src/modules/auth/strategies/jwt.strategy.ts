import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Role } from '../../../common/enums/role.enum.js';
import { TeamsService } from '../../teams/teams.service.js';
import type { JwtPayload } from '../auth.service.js';
import type { AuthUser } from '../decorators/current-user.decorator.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly teamsService: TeamsService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('jwt.secret'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload): Promise<AuthUser> {
    let teamId = payload.teamId;

    const requestedTeamId = req.headers['x-team-id'];
    if (
      payload.role === Role.SYSTEM &&
      typeof requestedTeamId === 'string' &&
      requestedTeamId.length > 0
    ) {
      const team = await this.teamsService.findTeamInTenantOrNull(
        payload.tenantId,
        requestedTeamId,
      );
      if (team) {
        teamId = String(team._id);
      }
    }

    return {
      id: payload.sub,
      email: payload.email,
      tenantId: payload.tenantId,
      teamId,
      role: payload.role,
    };
  }
}
