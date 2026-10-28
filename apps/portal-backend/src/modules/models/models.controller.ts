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
import { CreateModelDto } from './dto/create-model.dto.js';
import { UpdateModelDto } from './dto/update-model.dto.js';
import { ModelsService } from './models.service.js';

@ApiTags('models')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('models')
export class ModelsController {
  constructor(private readonly modelsService: ModelsService) {}

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
  create(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Body() dto: CreateModelDto,
  ) {
    return this.modelsService.create(tenantId, teamId, dto);
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
  remove(
    @CurrentUser('tenantId') tenantId: string,
    @CurrentUser('teamId') teamId: string,
    @Param('id') id: string,
  ) {
    return this.modelsService.remove(tenantId, teamId, id);
  }
}
