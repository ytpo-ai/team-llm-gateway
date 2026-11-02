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
import { CreateRoleTemplateDto } from './dto/create-role-template.dto.js';
import { UpdateRoleTemplateDto } from './dto/update-role-template.dto.js';
import { RoleTemplatesService } from './role-templates.service.js';

@ApiTags('role-templates')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('role-templates')
export class RoleTemplatesController {
  constructor(
    private readonly roleTemplatesService: RoleTemplatesService,
    private readonly auditService: AuditService,
  ) {}

  @Get()
  @ApiOperation({ summary: '角色模板列表（内置 + 团队自定义）' })
  list(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
  ) {
    return this.roleTemplatesService.list(tenantId, teamId);
  }

  @Get(':id')
  @ApiOperation({ summary: '角色模板详情' })
  get(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.roleTemplatesService.get(tenantId, teamId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '创建角色模板' })
  async create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateRoleTemplateDto,
    @Req() req: Request,
  ) {
    const result = await this.roleTemplatesService.create(
      user.tenantId,
      user.teamId,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CREATE,
      resourceType: AuditResourceType.ROLE_TEMPLATE,
      resourceId: result.id,
      summary: `创建角色模板（${result.name}）`,
      after: { id: result.id, name: result.name },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '更新角色模板' })
  async update(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Body() dto: UpdateRoleTemplateDto,
    @Req() req: Request,
  ) {
    const result = await this.roleTemplatesService.update(
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
      resourceType: AuditResourceType.ROLE_TEMPLATE,
      resourceId: result.id,
      summary: `更新角色模板（${result.name}）`,
      after: { id: result.id, name: result.name },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '删除角色模板（内置不可删）' })
  async remove(
    @CurrentUser() user: AuthUser,
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const result = await this.roleTemplatesService.remove(
      user.tenantId,
      user.teamId,
      id,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.DISABLE,
      resourceType: AuditResourceType.ROLE_TEMPLATE,
      resourceId: result.id,
      summary: `删除角色模板（${result.name}）`,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
