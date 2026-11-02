import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Role } from '../../common/enums/role.enum.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuditService } from '../system/audit.service.js';
import {
  AuditAction,
  AuditResourceType,
} from '../system/schemas/audit-log.schema.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateMemberDto } from './dto/create-member.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '当前租户的团队列表' })
  list(@CurrentUser('tenantId') tenantId: string) {
    return this.teamsService.listTeams(tenantId);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '创建团队' })
  create(
    @CurrentUser('tenantId') tenantId: string,
    @Body() dto: CreateTeamDto,
  ) {
    return this.teamsService.createTeam(tenantId, dto.name);
  }

  @Patch(':teamId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '更新团队名称' })
  rename(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Body() dto: UpdateTeamDto,
  ) {
    return this.teamsService.renameTeam(tenantId, teamId, dto.name);
  }

  @Get(':teamId/members')
  @ApiOperation({ summary: '成员列表' })
  members(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.listMembers(tenantId, teamId);
  }

  @Post(':teamId/members')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '直接添加成员（无需登录，密码可选）' })
  async createMember(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() dto: CreateMemberDto,
    @Req() req: Request,
  ) {
    const result = await this.teamsService.createMember(
      user.tenantId,
      teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.MEMBER,
      resourceId: result.id,
      summary: `添加成员（${result.name}）`,
      after: { id: result.id, name: result.name, role: result.role },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '更新成员角色/状态' })
  async updateMember(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
    @Req() req: Request,
  ) {
    const result = await this.teamsService.updateMember(
      user.tenantId,
      teamId,
      userId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.MEMBER_UPDATE,
      resourceType: AuditResourceType.MEMBER,
      resourceId: userId,
      summary: `更新成员（${result?.id ?? userId}）角色/状态`,
      after: { userId, role: dto.role, status: dto.status },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '移除成员（禁用）' })
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Req() req: Request,
  ) {
    const result = await this.teamsService.removeMember(
      user.tenantId,
      teamId,
      userId,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.MEMBER_REMOVE,
      resourceType: AuditResourceType.MEMBER,
      resourceId: userId,
      summary: `移除成员（${userId}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Post(':teamId/invitations')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '创建成员邀请' })
  async createInvitation(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() dto: CreateInvitationDto,
    @Req() req: Request,
  ) {
    const result = await this.teamsService.createInvitation(
      user.tenantId,
      teamId,
      dto.email,
      dto.role,
      user.id,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.INVITE,
      resourceType: AuditResourceType.INVITATION,
      resourceId: result.invitation.id,
      summary: `邀请成员（${dto.email}，角色 ${dto.role}）`,
      after: { email: dto.email, role: dto.role },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Get(':teamId/invitations')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '邀请列表' })
  invitations(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.listInvitations(tenantId, teamId);
  }

  @Delete(':teamId/invitations/:invitationId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '撤销邀请' })
  async revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Param('invitationId') invitationId: string,
    @Req() req: Request,
  ) {
    const result = await this.teamsService.revokeInvitation(
      user.tenantId,
      teamId,
      invitationId,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.INVITE_REVOKE,
      resourceType: AuditResourceType.INVITATION,
      resourceId: invitationId,
      summary: `撤销邀请（${result.email}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
