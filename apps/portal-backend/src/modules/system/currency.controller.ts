import {
  Body,
  Controller,
  Get,
  Put,
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
import { AuditService } from './audit.service.js';
import { CurrencyService } from './currency.service.js';
import { UpdateCurrencyDto } from './dto/update-currency.dto.js';
import {
  AuditAction,
  AuditResourceType,
} from './schemas/audit-log.schema.js';

@ApiTags('system')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('system')
export class CurrencyController {
  constructor(
    private readonly currencyService: CurrencyService,
    private readonly auditService: AuditService,
  ) {}

  @Get('currency')
  @Roles(Role.MEMBER)
  @ApiOperation({ summary: '读取货币汇率配置（member 及以上）' })
  getCurrency(@CurrentUser('tenantId') tenantId: string) {
    return this.currencyService.getConfig(tenantId);
  }

  @Put('currency')
  @Roles(Role.TEAM_ADMIN, Role.SYSTEM)
  @ApiOperation({ summary: '更新货币汇率配置（team_admin/system）' })
  async updateCurrency(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateCurrencyDto,
    @Req() req: Request,
  ) {
    const before = await this.currencyService.getConfig(user.tenantId);
    const result = await this.currencyService.saveConfig(
      user.tenantId,
      user.id,
      dto,
    );
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.CURRENCY_UPDATE,
      resourceType: AuditResourceType.CURRENCY,
      resourceId: null,
      summary: '更新货币汇率配置',
      before,
      after: result,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
