import { Controller, Get } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Connection } from 'mongoose';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  @Get()
  @ApiOperation({ summary: '服务健康检查' })
  check() {
    return {
      status: 'ok',
      mongo: this.connection.readyState === 1 ? 'up' : 'down',
      timestamp: new Date().toISOString(),
    };
  }
}
