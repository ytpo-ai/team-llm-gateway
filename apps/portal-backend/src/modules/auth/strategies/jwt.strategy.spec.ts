import { Types } from 'mongoose';
import type { Request } from 'express';
import { Role } from '../../../common/enums/role.enum.js';
import type { JwtPayload } from '../auth.service.js';
import { JwtStrategy } from './jwt.strategy.js';

describe('JwtStrategy', () => {
  const teamsService = {
    findTeamInTenantOrNull: vi.fn(),
  };
  const configService = {
    getOrThrow: vi.fn().mockReturnValue('test-secret'),
  };

  const strategy = new JwtStrategy(
    configService as never,
    teamsService as never,
  );

  const tenantId = String(new Types.ObjectId());
  const teamId = String(new Types.ObjectId());
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

  it('returns payload teamId when no header is present', async () => {
    const req = { headers: {} } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.teamId).toBe(teamId);
    expect(teamsService.findTeamInTenantOrNull).not.toHaveBeenCalled();
  });

  it('overrides teamId for system when the header team belongs to the tenant', async () => {
    teamsService.findTeamInTenantOrNull.mockResolvedValue({
      _id: new Types.ObjectId(otherTeamId),
    });
    const req = {
      headers: { 'x-team-id': otherTeamId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.teamId).toBe(otherTeamId);
    expect(teamsService.findTeamInTenantOrNull).toHaveBeenCalledWith(
      tenantId,
      otherTeamId,
    );
  });

  it('ignores the header for non-system roles', async () => {
    const req = {
      headers: { 'x-team-id': otherTeamId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.TEAM_ADMIN));

    expect(result.teamId).toBe(teamId);
    expect(teamsService.findTeamInTenantOrNull).not.toHaveBeenCalled();
  });

  it('falls back to payload teamId when the header team is not found', async () => {
    teamsService.findTeamInTenantOrNull.mockResolvedValue(null);
    const req = {
      headers: { 'x-team-id': otherTeamId },
    } as unknown as Request;

    const result = await strategy.validate(req, makePayload(Role.SYSTEM));

    expect(result.teamId).toBe(teamId);
  });
});
