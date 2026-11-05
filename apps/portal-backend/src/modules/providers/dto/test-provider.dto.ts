import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class TestProviderDto {
  @ApiPropertyOptional({ example: 'gpt-4o-mini', description: '指定测试模型 ID（可选，不传则自动探测）' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  modelId?: string;

  @ApiPropertyOptional({ example: '请问你是哪个模型？', description: '自定义测试消息（可选，不传则发送 ping）' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}