import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import { UserStatus } from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import {
  InvitationStatus,
} from './schemas/invitation.schema.js';
import { TeamStatus } from './schemas/team.schema.js';
import { TeamsService } from './teams.service.js';

describe('TeamsService', () => {
  let service: TeamsService;

  const tenantId = new Types.ObjectId();
  const teamId = new Types.ObjectId();
  const userId = new Types.ObjectId();
  const invitationId = new Types.ObjectId();

  const teamModel = {
    findOne: vi.fn(),
    find: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
  };

  const invitationModel = {
    findOne: vi.fn(),
    find: vi.fn(),
    create: vi.fn(),
    updateOne: vi.fn(),
  };

  const usersService = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    listByTeam: vi.fn(),
    updateById: vi.fn(),
  };

  const team = {
    _id: teamId,
    tenantId,
    name: '默认团队',
    status: TeamStatus.ACTIVE,
    save: vi.fn(async () => team),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamsService,
        { provide: 'TeamModel', useValue: teamModel },
        { provide: 'InvitationModel', useValue: invitationModel },
        { provide: UsersService, useValue: usersService },
      ],
    }).compile();

    service = module.get(TeamsService);
  });

  describe('ensureDefaultTeam', () => {
    it('should return existing team when present', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });

      const result = await service.ensureDefaultTeam(tenantId);

      expect(result).toEqual(team);
      expect(teamModel.create).not.toHaveBeenCalled();
    });

    it('should create default team when missing', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
      teamModel.create.mockResolvedValue(team);

      const result = await service.ensureDefaultTeam(tenantId);

      expect(teamModel.create).toHaveBeenCalledWith({
        tenantId,
        name: '默认团队',
      });
      expect(result).toEqual(team);
    });
  });

  describe('createTeam', () => {
    it('should throw ConflictException on duplicate name', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });

      await expect(
        service.createTeam(String(tenantId), '默认团队'),
      ).rejects.toThrow(ConflictException);
    });

    it('should create team', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(null) });
      teamModel.create.mockResolvedValue(team);

      const result = await service.createTeam(String(tenantId), '研发组');

      expect(teamModel.create).toHaveBeenCalledWith({
        tenantId: String(tenantId),
        name: '研发组',
      });
      expect(result).toEqual(team);
    });
  });

  describe('createInvitation', () => {
    it('should create pending invitation and return a raw token', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });
      usersService.findByEmail.mockResolvedValue(null);
      invitationModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });
      invitationModel.create.mockImplementation(async (input: any) => ({
        _id: invitationId,
        ...input,
        createdAt: new Date(),
      }));

      const result = await service.createInvitation(
        String(tenantId),
        String(teamId),
        'member@example.com',
        Role.MEMBER,
        String(userId),
      );

      expect(invitationModel.create).toHaveBeenCalledWith(
        expect.objectContaining({
          teamId: String(teamId),
          email: 'member@example.com',
          role: Role.MEMBER,
          status: InvitationStatus.PENDING,
          invitedBy: String(userId),
        }),
      );
      expect(result.token).toBeTruthy();
      expect(result.invitation.email).toBe('member@example.com');
    });

    it('should throw ConflictException when email is already a member', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });
      usersService.findByEmail.mockResolvedValue({ _id: userId });

      await expect(
        service.createInvitation(
          String(tenantId),
          String(teamId),
          'member@example.com',
          Role.MEMBER,
          String(userId),
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('revokeInvitation', () => {
    it('should mark a pending invitation as revoked', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });
      const invitation = {
        _id: invitationId,
        teamId,
        email: 'member@example.com',
        role: Role.MEMBER,
        tokenHash: 'hash',
        expiresAt: new Date(),
        status: InvitationStatus.PENDING,
        createdAt: new Date(),
        save: vi.fn(async () => invitation),
      };
      invitationModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(invitation),
      });

      const result = await service.revokeInvitation(
        String(tenantId),
        String(teamId),
        String(invitationId),
      );

      expect(invitation.status).toBe(InvitationStatus.REVOKED);
      expect(result.status).toBe(InvitationStatus.REVOKED);
    });

    it('should throw NotFoundException when invitation missing', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });
      invitationModel.findOne.mockReturnValue({
        exec: vi.fn().mockResolvedValue(null),
      });

      await expect(
        service.revokeInvitation(
          String(tenantId),
          String(teamId),
          String(invitationId),
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('removeMember', () => {
    it('should disable a member in the team', async () => {
      teamModel.findOne.mockReturnValue({ exec: vi.fn().mockResolvedValue(team) });
      usersService.findById.mockResolvedValue({
        _id: userId,
        tenantId,
        teamId,
        status: UserStatus.ACTIVE,
      });
      usersService.updateById.mockResolvedValue({ status: UserStatus.DISABLED });

      await service.removeMember(
        String(tenantId),
        String(teamId),
        String(userId),
      );

      expect(usersService.updateById).toHaveBeenCalledWith(String(userId), {
        status: UserStatus.DISABLED,
      });
    });
  });
});
