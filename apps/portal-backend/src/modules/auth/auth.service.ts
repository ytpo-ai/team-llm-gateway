import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, type JwtSignOptions } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { TenantService } from '../tenant/tenant.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { UserStatus, type UserDocument } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { RegisterDto } from './dto/register.dto.js';

export interface JwtPayload {
  sub: string;
  email: string;
  tenantId: string;
  teamId: string;
  role: Role;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly tenantService: TenantService,
    private readonly teamsService: TeamsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: RegisterDto) {
    const tenant = await this.tenantService.ensureDefaultTenant(dto.tenantName);
    const team = await this.teamsService.ensureDefaultTeam(tenant._id, tenant.name);

    const existing = await this.usersService.findByEmail(
      tenant._id,
      dto.email,
    );
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      tenantId: tenant._id,
      teamId: team._id,
      email: dto.email,
      name: dto.name,
      passwordHash,
      role: Role.SYSTEM,
    });

    const tokens = await this.issueTokens(user, team._id);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async login(dto: LoginDto) {
    const systemUser = await this.usersService.findSystemUserByEmail(dto.email);
    if (systemUser) {
      return this.loginUser(systemUser, dto.password);
    }

    const tenant = await this.tenantService.ensureDefaultTenant();
    const user = await this.usersService.findByEmail(tenant._id, dto.email);
    return this.loginUser(user, dto.password);
  }

  private async loginUser(
    user: UserDocument | null,
    password: string,
  ) {
    if (!user) {
      throw new UnauthorizedException('邮箱或密码错误');
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('账号已被禁用');
    }
    if (!user.passwordHash) {
      throw new UnauthorizedException('该成员未设置密码，无法登录');
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('邮箱或密码错误');
    }

    const teamId = await this.resolveTeamId(user);
    const tokens = await this.issueTokens(user, teamId);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtPayload;
    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(
        dto.refreshToken,
        {
          secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
        },
      );
    } catch {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    const user = await this.usersService.findById(payload.sub);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('无效的刷新令牌');
    }

    const teamId = await this.resolveTeamId(user);
    return this.issueTokens(user, teamId);
  }

  async acceptInvite(dto: AcceptInviteDto) {
    const { invitation, team } =
      await this.teamsService.validateInvitation(dto.token);

    const existing = await this.usersService.findByEmail(
      team.tenantId,
      invitation.email,
    );
    if (existing) {
      throw new ConflictException('该邮箱已注册');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.create({
      tenantId: team.tenantId,
      teamId: team._id,
      email: invitation.email,
      name: dto.name,
      passwordHash,
      role: invitation.role,
    });

    await this.teamsService.markInvitationAccepted(invitation._id);

    const tokens = await this.issueTokens(user, team._id);
    return { user: this.toPublicUser(user), ...tokens };
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }
    return this.toPublicUser(user);
  }

  private async resolveTeamId(
    user: UserDocument,
  ): Promise<Types.ObjectId | null> {
    if (user.role === Role.SYSTEM) {
      return user.teamId ?? null;
    }
    if (user.teamId) {
      return user.teamId;
    }
    const team = await this.teamsService.ensureDefaultTeam(
      user.tenantId as Types.ObjectId,
    );
    await this.usersService.updateById(String(user._id), { teamId: team._id });
    return team._id;
  }

  private async issueTokens(
    user: UserDocument,
    teamId: Types.ObjectId | null,
  ) {
    const payload: JwtPayload = {
      sub: String(user._id),
      email: user.email ?? '',
      tenantId: user.tenantId ? String(user.tenantId) : '',
      teamId: teamId ? String(teamId) : '',
      role: user.role,
    };
    const accessToken = await this.jwtService.signAsync(payload);
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.getOrThrow<string>('jwt.refreshSecret'),
      expiresIn: this.configService.getOrThrow<string>(
        'jwt.refreshExpiresIn',
      ) as JwtSignOptions['expiresIn'],
    });
    return { accessToken, refreshToken };
  }

  private toPublicUser(user: UserDocument) {
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      tenantId: user.tenantId ? String(user.tenantId) : '',
      teamId: user.teamId ? String(user.teamId) : null,
    };
  }
}
