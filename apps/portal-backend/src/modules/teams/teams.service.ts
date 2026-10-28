import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { createHash, randomBytes } from 'node:crypto';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/role.enum.js';
import {
  UserDocument,
  UserStatus,
} from '../users/schemas/user.schema.js';
import { UsersService } from '../users/users.service.js';
import {
  Invitation,
  InvitationDocument,
  InvitationStatus,
} from './schemas/invitation.schema.js';
import { Team, TeamDocument, TeamStatus } from './schemas/team.schema.js';

export const DEFAULT_TEAM_NAME = '默认团队';

const INVITATION_TTL_DAYS = 7;

export interface InvitationContext {
  invitation: InvitationDocument;
  team: TeamDocument;
}

export interface TeamView {
  id: string;
  name: string;
  status: TeamStatus;
  tenantId: string;
}

export interface InvitationView {
  id: string;
  email: string;
  role: Role;
  status: InvitationStatus;
  expiresAt: Date;
  createdAt?: Date;
}

@Injectable()
export class TeamsService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<Team>,
    @InjectModel(Invitation.name)
    private readonly invitationModel: Model<Invitation>,
    private readonly usersService: UsersService,
  ) {}

  async ensureDefaultTeam(
    tenantId: Types.ObjectId,
    name = DEFAULT_TEAM_NAME,
  ): Promise<TeamDocument> {
    const existing = await this.teamModel.findOne({ tenantId }).exec();
    if (existing) {
      return existing;
    }
    return this.teamModel.create({ tenantId, name });
  }

  async listTeams(tenantId: string): Promise<TeamView[]> {
    const teams = await this.teamModel
      .find({ tenantId })
      .sort({ createdAt: 1 })
      .exec();
    return teams.map((team) => this.toTeamView(team));
  }

  async createTeam(tenantId: string, name: string): Promise<TeamView> {
    const existing = await this.teamModel.findOne({ tenantId, name }).exec();
    if (existing) {
      throw new ConflictException('团队名称已存在');
    }
    const team = await this.teamModel.create({ tenantId, name });
    return this.toTeamView(team);
  }

  async renameTeam(
    tenantId: string,
    teamId: string,
    name: string,
  ): Promise<TeamView> {
    const team = await this.findTeamInTenant(tenantId, teamId);
    team.name = name;
    await team.save();
    return this.toTeamView(team);
  }

  async listMembers(tenantId: string, teamId: string) {
    await this.findTeamInTenant(tenantId, teamId);
    const users = await this.usersService.listByTeam(tenantId, teamId);
    return users.map((user) => this.toMemberView(user));
  }

  async updateMember(
    tenantId: string,
    teamId: string,
    userId: string,
    patch: { role?: Role; status?: UserStatus },
  ) {
    await this.findTeamInTenant(tenantId, teamId);
    const user = await this.usersService.findById(userId);
    if (
      !user ||
      String(user.tenantId) !== tenantId ||
      String(user.teamId) !== teamId
    ) {
      throw new NotFoundException('成员不存在');
    }
    const updated = await this.usersService.updateById(userId, patch);
    return updated ? this.toMemberView(updated) : null;
  }

  async removeMember(tenantId: string, teamId: string, userId: string) {
    await this.findTeamInTenant(tenantId, teamId);
    const user = await this.usersService.findById(userId);
    if (
      !user ||
      String(user.tenantId) !== tenantId ||
      String(user.teamId) !== teamId
    ) {
      throw new NotFoundException('成员不存在');
    }
    const updated = await this.usersService.updateById(userId, {
      status: UserStatus.DISABLED,
    });
    return updated ? this.toMemberView(updated) : null;
  }

  async createInvitation(
    tenantId: string,
    teamId: string,
    email: string,
    role: Role,
    invitedById: string,
  ) {
    await this.findTeamInTenant(tenantId, teamId);
    const normalized = email.toLowerCase();

    const member = await this.usersService.findByEmail(
      new Types.ObjectId(tenantId),
      normalized,
    );
    if (member) {
      throw new ConflictException('该邮箱已是团队成员');
    }

    const pending = await this.invitationModel
      .findOne({ teamId, email: normalized, status: InvitationStatus.PENDING })
      .exec();
    if (pending) {
      throw new ConflictException('该邮箱已有待接受的邀请');
    }

    const token = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(
      Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000,
    );

    const invitation = await this.invitationModel.create({
      teamId,
      email: normalized,
      role,
      tokenHash,
      expiresAt,
      status: InvitationStatus.PENDING,
      invitedBy: invitedById,
    });

    return { invitation: this.toInvitationView(invitation), token };
  }

  async listInvitations(
    tenantId: string,
    teamId: string,
  ): Promise<InvitationView[]> {
    await this.findTeamInTenant(tenantId, teamId);
    const list = await this.invitationModel
      .find({ teamId })
      .sort({ createdAt: -1 })
      .exec();
    return list.map((item) => this.toInvitationView(item));
  }

  async revokeInvitation(
    tenantId: string,
    teamId: string,
    invitationId: string,
  ): Promise<InvitationView> {
    await this.findTeamInTenant(tenantId, teamId);
    const invitation = await this.invitationModel
      .findOne({ _id: invitationId, teamId })
      .exec();
    if (!invitation) {
      throw new NotFoundException('邀请不存在');
    }
    if (invitation.status !== InvitationStatus.PENDING) {
      throw new BadRequestException('该邀请已处理');
    }
    invitation.status = InvitationStatus.REVOKED;
    await invitation.save();
    return this.toInvitationView(invitation);
  }

  async validateInvitation(token: string): Promise<InvitationContext> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const invitation = await this.invitationModel
      .findOne({ tokenHash, status: InvitationStatus.PENDING })
      .exec();
    if (!invitation) {
      throw new BadRequestException('邀请无效或已失效');
    }
    if (invitation.expiresAt.getTime() < Date.now()) {
      throw new BadRequestException('邀请已过期');
    }
    const team = await this.teamModel.findById(invitation.teamId).exec();
    if (!team || team.status !== TeamStatus.ACTIVE) {
      throw new BadRequestException('邀请对应的团队不可用');
    }
    return { invitation, team };
  }

  async markInvitationAccepted(invitationId: Types.ObjectId): Promise<void> {
    await this.invitationModel
      .updateOne({ _id: invitationId }, { status: InvitationStatus.ACCEPTED })
      .exec();
  }

  private toInvitationView(invitation: InvitationDocument): InvitationView {
    return {
      id: String(invitation._id),
      email: invitation.email,
      role: invitation.role,
      status: invitation.status,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
    };
  }

  private toTeamView(team: TeamDocument): TeamView {
    return {
      id: String(team._id),
      name: team.name,
      status: team.status,
      tenantId: String(team.tenantId),
    };
  }

  private toMemberView(user: UserDocument) {
    return {
      id: String(user._id),
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      tenantId: String(user.tenantId),
      teamId: user.teamId ? String(user.teamId) : null,
    };
  }

  private async findTeamInTenant(
    tenantId: string,
    teamId: string,
  ): Promise<TeamDocument> {
    const team = await this.teamModel.findOne({ _id: teamId, tenantId }).exec();
    if (!team) {
      throw new NotFoundException('团队不存在');
    }
    return team;
  }
}
