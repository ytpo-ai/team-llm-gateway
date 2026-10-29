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
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { ProvidersService } from './providers.service.js';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEAM_ADMIN)
@Controller('providers')
export class ProvidersController {
  constructor(
    private readonly providersService: ProvidersService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '上游渠道列表（team_admin，key 脱敏）' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
  ) {
    return this.providersService.list(tenantId, teamId);
  }

  @Post()
  @ApiOperation({ summary: '创建上游渠道（上游 key 明文输入 → 密文落库）' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderDto,
    @Req() req: Request,
  ) {
    const result = await this.providersService.create(
      user.tenantId,
      user.teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.PROVIDER,
      resourceId: result.id,
      summary: `创建上游渠道（${result.name}）`,
      after: { id: result.id, name: result.name, type: result.type },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: '上游渠道详情（key 脱敏）' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.providersService.get(tenantId, teamId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新上游渠道（可换 key）' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
    @Body() dto: UpdateProviderDto,
  ) {
    return this.providersService.update(tenantId, teamId, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除上游渠道（软禁用）' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.providersService.remove(
      user.tenantId,
      user.teamId,
      id,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.DISABLE,
      resourceType: AuditResourceType.PROVIDER,
      resourceId: result.id,
      summary: `禁用上游渠道（${result.name}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
