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
import { CreatePolicySetDto } from './dto/create-policy-set.dto.js';
import { UpdatePolicySetDto } from './dto/update-policy-set.dto.js';
import { PolicySetsService } from './policy-sets.service.js';

@ApiTags('policy-sets')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('policy-sets')
export class PolicySetsController {
  constructor(
    private readonly policySetsService: PolicySetsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '策略集列表（内置 + 团队自定义）' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
  ) {
    return this.policySetsService.list(tenantId, teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: '策略集详情' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.policySetsService.get(tenantId, teamId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '创建策略集' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePolicySetDto,
    @Req() req: Request,
  ) {
    const result = await this.policySetsService.create(
      user.tenantId,
      user.teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.POLICY_SET,
      resourceId: result.id,
      summary: `创建策略集（${result.name}）`,
      after: { id: result.id, name: result.name },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '更新策略集' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdatePolicySetDto,
    @Req() req: Request,
  ) {
    const result = await this.policySetsService.update(
      user.tenantId,
      user.teamId,
      id,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.UPDATE,
      resourceType: AuditResourceType.POLICY_SET,
      resourceId: result.id,
      summary: `更新策略集（${result.name}）`,
      after: { id: result.id, name: result.name },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '删除策略集（内置不可删）' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.policySetsService.remove(
      user.tenantId,
      user.teamId,
      id,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.DISABLE,
      resourceType: AuditResourceType.POLICY_SET,
      resourceId: result.id,
      summary: `删除策略集（${result.name}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
