import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProviderType } from '../schemas/provider.schema.js';

export class CreateProviderFromPresetDto {
  @ApiProperty({ example: 'deepseek', description: '官方预置 key（来自 GET /models/presets）' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  presetKey: string;

  @ApiProperty({ example: 'sk-xxx' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  apiKey: string;

  @ApiPropertyOptional({ example: 'DeepSeek 公司主账号', description: '自定义渠道名称，默认使用预置 label' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ProviderType, description: '接入格式（协议类型），缺省取预置第一个格式' })
  @IsOptional()
  @IsEnum(ProviderType)
  format?: ProviderType;

  @ApiPropertyOptional({ example: 'https://api.deepseek.com', description: '覆盖预置 Base URL（协议类型仍由 format 决定）' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({ example: 0, description: '渠道默认优先级（0=P0, 1=P1, 2=P2），导入模型时作为绑定优先级', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  defaultPriority?: number;
}
