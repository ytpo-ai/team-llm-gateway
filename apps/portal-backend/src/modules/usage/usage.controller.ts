import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { UsageQueryDto } from './dto/usage-query.dto.js';
import { UsageLogQueryDto } from './dto/usage-log-query.dto.js';
import { UsageService } from './usage.service.js';

@ApiTags('usage')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('usage')
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get('summary')
  @ApiOperation({ summary: '用量总览（member 仅本人，其余角色团队全量）' })
  summary(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageQueryDto,
  ) {
    return this.usageService.summary(user, query);
  }

  @Get('trends')
  @ApiOperation({ summary: '用量趋势（时间序列）' })
  trends(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageQueryDto,
  ) {
    return this.usageService.trends(user, query);
  }

  @Get('by-model')
  @ApiOperation({ summary: '按模型拆分' })
  byModel(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageQueryDto,
  ) {
    return this.usageService.byModel(user, query);
  }

  @Get('by-member')
  @ApiOperation({ summary: '按成员拆分' })
  byMember(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageQueryDto,
  ) {
    return this.usageService.byMember(user, query);
  }

  @Get('by-key')
  @ApiOperation({ summary: '按 API Key 拆分' })
  byKey(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageQueryDto,
  ) {
    return this.usageService.byKey(user, query);
  }

  @Get('logs')
  @ApiOperation({ summary: '使用日志（请求级分页明细）' })
  logs(
    @CurrentUser() user: AuthUser,
    @Query() query: UsageLogQueryDto,
  ) {
    return this.usageService.listLogs(user, query);
  }
}
