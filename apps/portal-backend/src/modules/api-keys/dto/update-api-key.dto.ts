import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ example: '我的开发密钥' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ type: [String], example: ['gpt-4o-mini'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedModels?: string[];

  @ApiPropertyOptional({ example: 60, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMinute?: number | null;

  @ApiPropertyOptional({ example: 1000000, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number | null;
}
