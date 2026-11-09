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
import { BatchTestProviderDto } from './dto/batch-test-provider.dto.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { CreateProviderFromPresetDto } from './dto/create-provider-from-preset.dto.js';
import { TestProviderDto } from './dto/test-provider.dto.js';
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

  @Post('from-preset')
  @ApiOperation({ summary: '一键开启官方直连渠道（预填名称/类型/Base URL，模型需后续导入）' })
  async createFromPreset(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateProviderFromPresetDto,
    @Req() req: Request,
  ) {
    const result = await this.providersService.createFromPreset(
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
      summary: `一键开启官方直连渠道（${result.name}）`,
      after: {
        id: result.id,
        name: result.name,
        type: result.type,
        presetKey: result.presetKey,
      },
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

  @Post(':id/test')
  @ApiOperation({ summary: '上游连通性探活（支持指定模型和自定义消息，不落库不计量）' })
  test(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
    @Body() dto?: TestProviderDto,
  ) {
    return this.providersService.test(
      tenantId,
      teamId,
      id,
      dto?.modelId,
      dto?.message,
    );
  }

  @Post(':id/sync-models')
  @ApiOperation({ summary: '将渠道对应预置的缺失模型补全到团队模型目录' })
  syncModels(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.providersService.syncPresetModels(tenantId, teamId, id);
  }

  @Post(':id/batch-test')
  @ApiOperation({ summary: '批量探测指定模型连通性（不落库不计量）' })
  batchTest(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
    @Body() dto: BatchTestProviderDto,
  ) {
    return this.providersService.batchTest(
      tenantId,
      teamId,
      id,
      dto.modelIds,
      dto.message,
    );
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

  @Post(':id/disable')
  @ApiOperation({ summary: '禁用上游渠道（软禁用，可恢复，级联禁用其下模型）' })
  async disable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.providersService.disable(
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

  @Post(':id/enable')
  @ApiOperation({ summary: '启用上游渠道（级联启用其下模型）' })
  async enable(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.providersService.enable(
      user.tenantId,
      user.teamId,
      id,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.ENABLE,
      resourceType: AuditResourceType.PROVIDER,
      resourceId: result.id,
      summary: `启用上游渠道（${result.name}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除上游渠道（硬删除，级联删除其下模型）' })
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
      action: AuditAction.DELETE,
      resourceType: AuditResourceType.PROVIDER,
      resourceId: result.id,
      summary: `删除上游渠道（${result.name}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
