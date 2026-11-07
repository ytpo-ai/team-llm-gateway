import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, IsUrl, Max, MaxLength, Min, MinLength } from 'class-validator';
import { ProviderAuthType, ProviderType } from '../schemas/provider.schema.js';

export class CreateProviderDto {
  @ApiProperty({ example: 'OpenAI 直连' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ enum: ProviderType, example: ProviderType.OPENAI_COMPATIBLE })
  @IsOptional()
  @IsEnum(ProviderType)
  type?: ProviderType;

  @ApiPropertyOptional({ enum: ProviderAuthType, example: ProviderAuthType.API_KEY })
  @IsOptional()
  @IsEnum(ProviderAuthType)
  authType?: ProviderAuthType;

  @ApiProperty({ example: 'https://api.openai.com/v1' })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl: string;

  @ApiProperty({ example: 'sk-xxx' })
  @IsString()
  @MinLength(1)
  @MaxLength(10000)
  apiKey: string;

  @ApiPropertyOptional({ example: 'openai', description: '来源官方预置 key（可选，自定义渠道不填）' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  presetKey?: string;

  @ApiPropertyOptional({ example: 0, description: '渠道默认优先级（0=最高 P0, 1=P1, 2=P2），导入模型时作为绑定优先级', default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2)
  defaultPriority?: number;
}
