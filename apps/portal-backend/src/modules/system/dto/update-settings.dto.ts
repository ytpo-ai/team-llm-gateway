import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class UpdateSettingsDto {
  @ApiProperty({
    description: '待更新的配置键值对（如 { "notification.quotaThreshold": 80 }）',
    example: { 'notification.quotaThreshold': 80 },
  })
  @IsObject()
  settings: Record<string, unknown>;
}
