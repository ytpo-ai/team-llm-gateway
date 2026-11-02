import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { UsageStatus } from '../schemas/usage-log.schema.js';

export class UsageLogQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-29T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ description: '按成员筛选' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ description: '按 API Key 筛选' })
  @IsOptional()
  @IsMongoId()
  apiKeyId?: string;

  @ApiPropertyOptional({ description: '按模型筛选' })
  @IsOptional()
  @IsString()
  modelId?: string;

  @ApiPropertyOptional({ enum: UsageStatus })
  @IsOptional()
  @IsEnum(UsageStatus)
  status?: UsageStatus;
}
