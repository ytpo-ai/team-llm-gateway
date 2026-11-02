import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
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
}
