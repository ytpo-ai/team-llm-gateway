import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: '改绑成员 ID（team_admin 可指定）' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

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

  @ApiPropertyOptional({ description: '日 token 上限', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitDaily?: number | null;

  @ApiPropertyOptional({ description: '周 token 上限', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitWeekly?: number | null;

  @ApiPropertyOptional({ description: '月 token 上限', nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitMonthly?: number | null;

  @ApiPropertyOptional({ type: [String], description: '可用渠道白名单' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  providerIds?: string[];
}
