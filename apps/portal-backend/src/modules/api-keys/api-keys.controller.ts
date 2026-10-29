import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { AuditService } from '../system/audit.service.js';
import {
  AuditAction,
  AuditResourceType,
} from '../system/schemas/audit-log.schema.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(
    private readonly apiKeysService: ApiKeysService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'API Key 列表（成员看自己，team_admin 看全团队）' })
  list(
    @CurrentUser() user: AuthUser,
    @Query('userId') userId?: string,
  ) {
    return this.apiKeysService.list(user, userId);
  }

  @Post()
  @ApiOperation({ summary: '创建 API Key（完整值仅返回一次）' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateApiKeyDto,
    @Req() req: Request,
  ) {
    const result = await this.apiKeysService.create(user, dto);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.API_KEY,
      resourceId: result.apiKey.id,
      summary: `创建 API Key（${result.apiKey.name ?? result.apiKey.keyPrefix}）`,
      after: { id: result.apiKey.id, name: result.apiKey.name },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'API Key 详情（脱敏）' })
  get(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apiKeysService.get(user, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: '更新 API Key 限制/名称/过期时间' })
  update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateApiKeyDto,
  ) {
    return this.apiKeysService.update(user, id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: '吊销 API Key' })
  async revoke(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.apiKeysService.revoke(user, id);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.REVOKE,
      resourceType: AuditResourceType.API_KEY,
      resourceId: result.id,
      summary: `吊销 API Key（${result.name ?? result.keyPrefix}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: '轮换 API Key（新建 + 吊销旧 key）' })
  async rotate(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.apiKeysService.rotate(user, id);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.ROTATE,
      resourceType: AuditResourceType.API_KEY,
      resourceId: result.apiKey.id,
      summary: `轮换 API Key（旧 ${id} → 新 ${result.apiKey.id}）`,
      after: { oldId: id, newId: result.apiKey.id },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
