import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { CreateProviderDto } from './dto/create-provider.dto.js';
import { UpdateProviderDto } from './dto/update-provider.dto.js';
import { ProvidersService } from './providers.service.js';

@ApiTags('providers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.TEAM_ADMIN)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

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
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Body() dto: CreateProviderDto,
  ) {
    return this.providersService.create(tenantId, teamId, dto);
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

  @Delete(':id')
  @ApiOperation({ summary: '删除上游渠道（软禁用）' })
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.providersService.remove(tenantId, teamId, id);
  }
}
