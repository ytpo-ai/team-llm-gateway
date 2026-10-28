import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { TenantService } from '../tenant/tenant.service.js';
import { UserStatus } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import { AuthService } from './auth.service.js';

describe('AuthService', () => {
  let service: AuthService;

  const tenantId = new Types.ObjectId();
  const userId = new Types.ObjectId();

  const usersService = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };

  const tenantService = {
    ensureDefaultTenant: vi.fn(),
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

  beforeEach(async () => {
    vi.clearAllMocks();

    tenantService.ensureDefaultTenant.mockResolvedValue({
      _id: tenantId,
      code: 'default',
      name: '默认团队',
      status: 'active',
      config: {},
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
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('should create default tenant + admin and return tokens', async () => {
      const password = 'password123';
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockImplementation(async (input: any) => ({
        _id: userId,
        tenantId: input.tenantId,
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
      expect(usersService.create).toHaveBeenCalledWith(
        expect.objectContaining({ role: Role.TEAM_ADMIN }),
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
        _id: userId,
        tenantId,
        email: 'admin@example.com',
        name: '张三',
        passwordHash: await bcrypt.hash(password, 4),
        role: Role.TEAM_ADMIN,
        status: UserStatus.ACTIVE,
      });

      const result = await service.login({
        email: 'admin@example.com',
        password,
      });

      expect(result.accessToken).toBe('access-token');
      expect(result.refreshToken).toBe('refresh-token');
      expect(result.user.id).toBe(String(userId));
    });

    it('should throw UnauthorizedException for wrong password', async () => {
      usersService.findByEmail.mockResolvedValue({
        _id: userId,
        tenantId,
        email: 'admin@example.com',
        name: '张三',
        passwordHash: await bcrypt.hash('another-password', 4),
        role: Role.TEAM_ADMIN,
        status: UserStatus.ACTIVE,
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
        role: Role.TEAM_ADMIN,
      });
      usersService.findById.mockResolvedValue({
        _id: userId,
        tenantId,
        email: 'admin@example.com',
        name: '张三',
        role: Role.TEAM_ADMIN,
        status: UserStatus.ACTIVE,
      });

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
});
