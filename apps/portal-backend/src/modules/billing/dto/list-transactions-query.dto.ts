import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsMongoId,
  IsOptional,
  Max,
  Min,
} from 'class-validator';
import { QuotaAccountType } from '../schemas/quota-account.schema.js';
import { QuotaTransactionType } from '../schemas/quota-transaction.schema.js';

export class ListTransactionsQueryDto {
  @ApiPropertyOptional({ example: '2026-10-01T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  from?: string;

  @ApiPropertyOptional({ example: '2026-10-29T00:00:00.000Z' })
  @IsOptional()
  @IsISO8601()
  to?: string;

  @ApiPropertyOptional({ enum: QuotaTransactionType })
  @IsOptional()
  @IsEnum(QuotaTransactionType)
  type?: QuotaTransactionType;

  @ApiPropertyOptional({ enum: QuotaAccountType })
  @IsOptional()
  @IsEnum(QuotaAccountType)
  accountType?: QuotaAccountType;

  @ApiPropertyOptional({ example: '64f1c9e2a1b2c3d4e5f6a7b8' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ default: 20, maximum: 200, minimum: 1 })
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
