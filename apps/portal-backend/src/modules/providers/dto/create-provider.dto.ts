import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUrl, MaxLength, MinLength } from 'class-validator';
import { ProviderType } from '../schemas/provider.schema.js';

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

  @ApiProperty({ example: 'https://api.openai.com/v1' })
  @IsString()
  @IsUrl({ require_tld: false })
  @MaxLength(500)
  baseUrl: string;

  @ApiProperty({ example: 'sk-xxx' })
  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  apiKey: string;
}
