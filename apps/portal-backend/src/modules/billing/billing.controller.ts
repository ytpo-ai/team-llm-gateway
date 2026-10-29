import {
  Body,
  Controller,
  Get,
  Post,
  Query,
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
import { BillingService } from './billing.service.js';
import { AdjustQuotaDto } from './dto/adjust-quota.dto.js';
import { ListTransactionsQueryDto } from './dto/list-transactions-query.dto.js';
import { RechargeQuotaDto } from './dto/recharge-quota.dto.js';

@ApiTags('billing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('billing')
export class BillingController {
  constructor(
    private readonly billingService: BillingService,
    private readonly auditService: AuditService,
  ) {}

  @Get('accounts')
  @ApiOperation({ summary: '额度账户列表（member 仅本人，其余角色团队全量）' })
  listAccounts(@CurrentUser() user: AuthUser) {
    return this.billingService.listAccounts(user);
  }

  @Get('transactions')
  @ApiOperation({ summary: '额度流水列表' })
  listTransactions(
    @CurrentUser() user: AuthUser,
    @Query() query: ListTransactionsQueryDto,
  ) {
    return this.billingService.listTransactions(user, query);
  }

  @Post('recharge')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.FINANCE)
  @ApiOperation({ summary: '充值额度（team_admin/finance）' })
  async recharge(
    @CurrentUser() user: AuthUser,
    @Body() dto: RechargeQuotaDto,
    @Req() req: Request,
  ) {
    const result = await this.billingService.recharge(user, dto);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.RECHARGE,
      resourceType: AuditResourceType.BILLING,
      resourceId: result.id,
      summary: `充值额度 +${dto.amount}`,
      after: { amount: dto.amount, balance: result.balance },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }

  @Post('adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.TEAM_ADMIN, Role.FINANCE)
  @ApiOperation({ summary: '调整额度（team_admin/finance，正加负减）' })
  async adjust(
    @CurrentUser() user: AuthUser,
    @Body() dto: AdjustQuotaDto,
    @Req() req: Request,
  ) {
    const result = await this.billingService.adjust(user, dto);
    await this.auditService.log({
      tenantId: user.tenantId,
      teamId: user.teamId,
      actorUserId: user.id,
      action: AuditAction.ADJUST,
      resourceType: AuditResourceType.BILLING,
      resourceId: result.id,
      summary: `调整额度 ${dto.amount >= 0 ? '+' : ''}${dto.amount}`,
      after: { amount: dto.amount, balance: result.balance },
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
    });
    return result;
  }
}
