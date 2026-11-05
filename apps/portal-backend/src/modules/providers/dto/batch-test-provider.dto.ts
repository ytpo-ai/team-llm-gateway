import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MaxLength } from 'class-validator';

export class BatchTestProviderDto {
  @ApiProperty({
    example: ['gpt-4o-mini', 'gpt-4o'],
    description: '待测试的模型 ID 列表',
  })
  @IsArray()
  @IsString({ each: true })
  modelIds: string[];

  @ApiPropertyOptional({
    example: '请问你是哪个模型？',
    description: '自定义测试消息（可选，不传则发送 ping）',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  message?: string;
}