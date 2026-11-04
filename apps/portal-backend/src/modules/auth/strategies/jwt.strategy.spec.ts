import { Types } from 'mongoose';
import type { Request } from 'express';
import { Role } from '../../../common/enums/role.enum.js';
import type { JwtPayload } from '../auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const teamsService = {
    findFirstTeamForTenantOrNull: vi.fn(),
  };
  const tenantService = {
    findByIdOrNull: vi.fn(),
  };
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('test-secret'),
  };

  const strategy = new JwtStrategy(
    configService as never,
    teamsService as never,
    tenantService as never,
  );

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
  const otherTenantId = String(new Types.ObjectId());
  const otherTeamId = String(new Types.ObjectId());

  const makePayload = (role: Role): JwtPayload => ({
    sub: 'user-1',
    email: 'admin@example.com',
    tenantId,
    teamId,
    role,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns payload tenant/team when no header is present', async () => {
    const req = { headers: {} } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.tenantId).toBe(tenantId);
    expect(result.teamId).toBe(teamId);
    expect(tenantService.findByIdOrNull).not.toHaveBeenCalled();
  });

  it('overrides tenant and team for system when the tenant exists', async () => {
    tenantService.findByIdOrNull.mockResolvedValue({
      _id: new Types.ObjectId(otherTenantId),
    });
    teamsService.findFirstTeamForTenantOrNull.mockResolvedValue({
      _id: new Types.ObjectId(otherTeamId),
    });
    const req = {
      headers: { 'x-tenant-id': otherTenantId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.tenantId).toBe(otherTenantId);
    expect(result.teamId).toBe(otherTeamId);
    expect(tenantService.findByIdOrNull).toHaveBeenCalledWith(otherTenantId);
    expect(teamsService.findFirstTeamForTenantOrNull).toHaveBeenCalledWith(
      otherTenantId,
    );
  });

  it('ignores the header for non-system roles', async () => {
    const req = {
      headers: { 'x-tenant-id': otherTenantId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.TEAM_ADMIN));

    expect(result.tenantId).toBe(tenantId);
    expect(result.teamId).toBe(teamId);
    expect(tenantService.findByIdOrNull).not.toHaveBeenCalled();
  });

  it('falls back to payload tenant/team when the tenant is not found', async () => {
    tenantService.findByIdOrNull.mockResolvedValue(null);
    const req = {
      headers: { 'x-tenant-id': otherTenantId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.tenantId).toBe(tenantId);
    expect(result.teamId).toBe(teamId);
  });
});
