import {
  Body,
  Controller,
  Get,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AuditService } from './audit.service.js';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto.js';
import { UpdateSettingsDto } from './dto/update-settings.dto.js';
import { SystemSettingsService } from './system-settings.service.js';

@ApiTags('system')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEAM_ADMIN)
@Controller('system')
export class SystemController {
  constructor(
    private readonly systemSettingsService: SystemSettingsService,
    private readonly auditService: AuditService,
  ) {}

  @Get('settings')
  @Roles(Role.SYSTEM)
  @ApiOperation({ summary: '系统配置列表（system）' })
  listSettings(@CurrentUser('tenantId') tenantId: string) {
    return this.systemSettingsService.list(tenantId);
  }

  @Put('settings')
  @Roles(Role.SYSTEM)
  @ApiOperation({ summary: '更新系统配置（批量 upsert，system）' })
  upsertSettings(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.systemSettingsService.upsert(
      user.tenantId,
      user.id,
      dto.settings,
    );
  }

  @Get('audit-logs')
  @ApiOperation({ summary: '审计日志列表（team_admin，分页 + 筛选）' })
  listAuditLogs(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAuditLogsQueryDto,
  ) {
    return this.auditService.list(user.tenantId, user.teamId, {
      action: query.action,
      resourceType: query.resourceType,
      userId: query.userId,
      from: query.from ? new Date(query.from) : undefined,
      to: query.to ? new Date(query.to) : undefined,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    });
  }
}
