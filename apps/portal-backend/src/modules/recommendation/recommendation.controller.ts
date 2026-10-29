import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RecommendationService } from './recommendation.service.js';

@ApiTags('recommendations')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('recommendations')
export class RecommendationController {
  constructor(
    private readonly recommendationService: RecommendationService,
  ) {}

  @Get('scenarios')
  @ApiOperation({ summary: '办公场景模板列表（所有成员可读）' })
  listScenarios() {
    return this.recommendationService.listScenarios();
  }

  @Get('scenarios/:id')
  @ApiOperation({ summary: '场景详情 + 实时推荐（所有成员可读）' })
  recommend(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.recommendationService.recommend(tenantId, teamId, id);
  }
}
