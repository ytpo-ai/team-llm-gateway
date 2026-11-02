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
import { CreateModelDto } from './dto/create-model.dto.js';
import { UpdateModelDto } from './dto/update-model.dto.js';
import { BulkCreateModelDto } from './dto/bulk-create-model.dto.js';
import { ModelsService } from './models.service.js';

@ApiTags('models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelsController {
  constructor(
    private readonly modelsService: ModelsService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '模型目录列表（所有成员可读）' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
  ) {
    return this.modelsService.list(tenantId, teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: '模型详情' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.modelsService.get(tenantId, teamId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '创建模型' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateModelDto,
    @Req() req: Request,
  ) {
    const result = await this.modelsService.create(
      user.tenantId,
      user.teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.MODEL,
      resourceId: result.id,
      summary: `创建模型（${result.modelId}）`,
      after: { id: result.id, modelId: result.modelId, multiplier: result.multiplier },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Post('bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '批量导入官方预设模型' })
  async bulkCreate(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkCreateModelDto,
    @Req() req: Request,
  ) {
    const result = await this.modelsService.bulkCreate(
      user.tenantId,
      user.teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.MODEL,
      resourceId: dto.providerId,
      summary: `批量导入模型（${result.created.length} 新增，${result.skipped.length} 跳过）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '更新模型' })
  update(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
    @Body() dto: UpdateModelDto,
  ) {
    return this.modelsService.update(tenantId, teamId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN)
  @ApiOperation({ summary: '删除模型（软禁用）' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.modelsService.remove(user.tenantId, user.teamId, id);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.DISABLE,
      resourceType: AuditResourceType.MODEL,
      resourceId: result.id,
      summary: `禁用模型（${result.modelId}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
