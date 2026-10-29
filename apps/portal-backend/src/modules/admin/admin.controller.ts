import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Role } from '../../common/enums/role.enum.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard.js';
import { RolesGuard } from '../auth/guards/roles.guard.js';
import { AdminService } from './admin.service.js';
import { CreateTenantDto } from './dto/create-tenant.dto.js';
import { ListTenantsQueryDto } from './dto/list-tenants-query.dto.js';
import { OverviewQueryDto } from './dto/overview-query.dto.js';
import { UpdateTenantStatusDto } from './dto/update-tenant-status.dto.js';

@ApiTags('admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SYSTEM)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('tenants')
  @ApiOperation({ summary: '租户列表（system，分页 + 筛选 + 计数）' })
  listTenants(@Query() query: ListTenantsQueryDto) {
    return this.adminService.listTenants(query);
  }

  @Post('tenants')
  @ApiOperation({ summary: '创建租户（system，含默认团队）' })
  createTenant(@Body() dto: CreateTenantDto) {
    return this.adminService.createTenant(dto.code, dto.name);
  }

  @Get('tenants/:id')
  @ApiOperation({ summary: '租户详情（system）' })
  getTenant(@Param('id') id: string) {
    return this.adminService.getTenant(id);
  }

  @Patch('tenants/:id/status')
  @ApiOperation({ summary: '启停租户（system）' })
  updateTenantStatus(
    @Param('id') id: string,
    @Body() dto: UpdateTenantStatusDto,
  ) {
    return this.adminService.updateTenantStatus(id, dto.status);
  }

  @Get('overview')
  @ApiOperation({ summary: '全局看板总量（system）' })
  overview(@Query() query: OverviewQueryDto) {
    return this.adminService.overview(query);
  }

  @Get('overview/usage')
  @ApiOperation({ summary: '按租户用量拆分（system）' })
  usageBreakdown(@Query() query: OverviewQueryDto) {
    return this.adminService.usageBreakdown(query);
  }
}
