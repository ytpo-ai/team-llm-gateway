import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateProviderFromPresetDto {
  @ApiProperty({ example: 'openai', description: '官方预置 key（来自 GET /models/presets）' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  presetKey: string;

  @ApiProperty({ example: 'sk-xxx' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  apiKey: string;

  @ApiPropertyOptional({ example: 'OpenAI 公司主账号', description: '自定义渠道名称，默认使用预置 label' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;
}
