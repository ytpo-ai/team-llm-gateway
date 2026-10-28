import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { TenantService } from '../tenant/tenant.service.js';
import { TeamsService } from '../teams/teams.service.js';
import { UserStatus } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const tenantId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const usersService = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    updateById: vi.fn(),
  };

  const tenantService = {
    ensureDefaultTenant: vi.fn(),
  };

  const teamsService = {
    ensureDefaultTeam: vi.fn(),
    validateInvitation: vi.fn(),
    markInvitationAccepted: vi.fn(),
  };

  const jwtService = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  const configService = {
    getOrThrow: vi.fn((key: string) => {
      if (key === 'jwt.refreshSecret') return 'refresh-secret';
      if (key === 'jwt.refreshExpiresIn') return '7d';
      return '';
    }),
  };

  const baseUser = {
    _id: userId,
    tenantId,
    teamId,
    email: 'admin@example.com',
    name: '张三',
    role: Role.TEAM_ADMIN,
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    tenantService.ensureDefaultTenant.mockResolvedValue({
      _id: tenantId,
      code: 'default',
      name: '默认团队',
      status: 'active',
      config: {},
    });

    teamsService.ensureDefaultTeam.mockResolvedValue({
      _id: teamId,
      tenantId,
      name: '默认团队',
      status: 'active',
    });

    jwtService.signAsync.mockImplementation(
      async (_payload: unknown, options?: unknown) =>
        options ? 'refresh-token' : 'access-token',
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: usersService },
        { provide: TenantService, useValue: tenantService },
        { provide: TeamsService, useValue: teamsService },
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should create default tenant + team + admin and return tokens', async () => {
      const password = 'password123';
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (input: any) => ({
        _id: userId,
        tenantId: input.tenantId,
        teamId: input.teamId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        role: input.role,
        status: UserStatus.ACTIVE,
      }));

      const result = await service.register({
        name: '张三',
        email: 'admin@example.com',
        password,
      });

      expect(tenantService.ensureDefaultTenant).toHaveBeenCalledWith(undefined);
      expect(teamsService.ensureDefaultTeam).toHaveBeenCalledWith(
        tenantId,
        '默认团队',
      );
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.TEAM_ADMIN, teamId }),
      );
      const createdHash = usersService.create.mock.calls[0][0].passwordHash;
      expect(createdHash).not.toBe(password);
      expect(await bcrypt.compare(password, createdHash)).toBe(true);

      expect(result).toEqual({
        user: {
          id: String(userId),
          email: 'admin@example.com',
          name: '张三',
          role: Role.TEAM_ADMIN,
          tenantId: String(tenantId),
          teamId: String(teamId),
        },
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw ConflictException when email already exists', async () => {
      usersService.findByEmail.mockResolvedValue({ _id: userId });

      await expect(
        service.register({
          name: '张三',
          email: 'admin@example.com',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('login', () => {
    it('should return tokens when credentials are valid', async () => {
      const password = 'password123';
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash(password, 4),
      });

      const result = await service.login({
        email: 'admin@example.com',
        password,
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe(String(userId));
      expect(result.user.teamId).toBe(String(teamId));
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue({
        ...baseUser,
        passwordHash: await bcrypt.hash('another-password', 4),
      });

      await expect(
        service.login({ email: 'admin@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'password123' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('refresh', () => {
    it('should issue new tokens for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({
        sub: String(userId),
        email: 'admin@example.com',
        tenantId: String(tenantId),
        teamId: String(teamId),
        role: Role.TEAM_ADMIN,
      });
      usersService.findById.mockResolvedValue(baseUser);

      const result = await service.refresh({ refreshToken: 'refresh-token' });

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
      });
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('expired'));

      await expect(
        service.refresh({ refreshToken: 'invalid' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('acceptInvite', () => {
    it('should create member and return tokens for a valid invitation', async () => {
      const invitation = {
        _id: new Types.ObjectId(),
        teamId,
        email: 'member@example.com',
        role: Role.MEMBER,
        tokenHash: 'hash',
        expiresAt: new Date(Date.now() + 10000),
        status: 'pending',
      };
      teamsService.validateInvitation.mockResolvedValue({
        invitation,
        team: { _id: teamId, tenantId, name: '默认团队', status: 'active' },
      });
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (input: any) => ({
        _id: userId,
        tenantId: input.tenantId,
        teamId: input.teamId,
        email: input.email,
        passwordHash: input.passwordHash,
        name: input.name,
        role: input.role,
        status: UserStatus.ACTIVE,
      }));
      teamsService.markInvitationAccepted.mockResolvedValue(undefined);

      const result = await service.acceptInvite({
        token: 'token-abc',
        name: '李四',
        password: 'password123',
      });

      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.MEMBER, teamId }),
      );
      expect(teamsService.markInvitationAccepted).toHaveBeenCalledWith(
        invitation._id,
      );
      expect(result.user.role).toBe(Role.MEMBER);
      expect(result.accessToken).toBe('access-token');
    });

    it('should throw ConflictException when email already registered', async () => {
      teamsService.validateInvitation.mockResolvedValue({
        invitation: {
          _id: new Types.ObjectId(),
          teamId,
          email: 'member@example.com',
          role: Role.MEMBER,
        },
        team: { _id: teamId, tenantId, name: '默认团队', status: 'active' },
      });
      usersService.findByEmail.mockResolvedValue({ _id: userId });

      await expect(
        service.acceptInvite({
          token: 'token-abc',
          name: '李四',
          password: 'password123',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });
});
