import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { AuditAction, AuditResourceType } from '../schemas/audit-log.schema.js';

export class ListAuditLogsQueryDto {
  @ApiPropertyOptional({ enum: AuditAction })
  @IsOptional()
  @IsEnum(AuditAction)
  action?: AuditAction;

  @ApiPropertyOptional({ enum: AuditResourceType })
  @IsOptional()
  @IsEnum(AuditResourceType)
  resourceType?: AuditResourceType;

  @ApiPropertyOptional({ example: '64f1c9e2a1b2c3d4e5f6a7b8' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-29T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ default: 50, maximum: 200, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  @Max(200)
  limit?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @Min(0)
  offset?: number;
}
