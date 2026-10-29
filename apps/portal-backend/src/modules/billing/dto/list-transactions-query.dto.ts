import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsISO8601, IsOptional } from 'class-validator';
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
}
