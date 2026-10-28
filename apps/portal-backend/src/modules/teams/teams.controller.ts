import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateInvitationDto } from './dto/create-invitation.dto.js';
import { CreateTeamDto } from './dto/create-team.dto.js';
import { UpdateMemberDto } from './dto/update-member.dto.js';
import { UpdateTeamDto } from './dto/update-team.dto.js';
import { TeamsService } from './teams.service.js';

@ApiTags('teams')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

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

  @Patch(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '更新成员角色/状态' })
  updateMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberDto,
  ) {
    return this.teamsService.updateMember(tenantId, teamId, userId, dto);
  }

  @Delete(':teamId/members/:userId')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '移除成员（禁用）' })
  removeMember(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeMember(tenantId, teamId, userId);
  }

  @Post(':teamId/invitations')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '创建成员邀请' })
  createInvitation(
    @CurrentUser() user: AuthUser,
    @Param('teamId') teamId: string,
    @Body() dto: CreateInvitationDto,
  ) {
    return this.teamsService.createInvitation(
      user.tenantId,
      teamId,
      dto.email,
      dto.role,
      user.id,
    );
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
  revokeInvitation(
    @CurrentUser('tenantId') tenantId: string,
    @Param('teamId') teamId: string,
    @Param('invitationId') invitationId: string,
  ) {
    return this.teamsService.revokeInvitation(tenantId, teamId, invitationId);
  }
}
