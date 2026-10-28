import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { AuthUser } from '../auth/decorators/current-user.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { ApiKeysService } from './api-keys.service.js';
import { CreateApiKeyDto } from './dto/create-api-key.dto.js';
import { UpdateApiKeyDto } from './dto/update-api-key.dto.js';

@ApiTags('api-keys')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

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
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateApiKeyDto) {
    return this.apiKeysService.create(user, dto);
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
  revoke(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apiKeysService.revoke(user, id);
  }

  @Post(':id/rotate')
  @ApiOperation({ summary: '轮换 API Key（新建 + 吊销旧 key）' })
  rotate(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    return this.apiKeysService.rotate(user, id);
  }
}
