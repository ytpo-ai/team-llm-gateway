import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProviderAuthType, ProviderStatus, ProviderType } from '../schemas/provider.schema.js';

export class UpdateProviderDto {
  @ApiPropertyOptional({ example: 'OpenAI 直连' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ enum: ProviderType })
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderAuthType })
  @IsOptional()
  @IsEnum(ProviderAuthType)
  authType?: ProviderAuthType;

  @ApiPropertyOptional({ example: 'https://api.openai.com/v1' })
  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl?: string;

  @ApiPropertyOptional({ example: 'sk-new', description: '提供则重新加密存储' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  apiKey?: string;

  @ApiPropertyOptional({ enum: ProviderStatus })
  @IsOptional()
  @IsEnum(ProviderStatus)
  status?: ProviderStatus;

  @ApiPropertyOptional({ example: 'openai', description: '来源官方预置 key（可选）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  presetKey?: string;

  @ApiPropertyOptional({ example: 0, description: '渠道默认优先级（0=P0 最高, 1=P1, 2=P2）', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  defaultPriority?: number;
}
