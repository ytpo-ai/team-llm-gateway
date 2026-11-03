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

export class CreateApiKeyDto {
  @ApiPropertyOptional({ description: '绑定成员 ID（team_admin 可指定，缺省为当前用户）' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: '我的开发密钥' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({ type: [String], example: ['gpt-4o-mini'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedModels?: string[];

  @ApiPropertyOptional({ example: 60 })
  @IsOptional()
  @IsInt()
  @Min(1)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({ example: 1000000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxTokens?: number;

  @ApiPropertyOptional({ description: '日 token 上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitDaily?: number;

  @ApiPropertyOptional({ description: '周 token 上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitWeekly?: number;

  @ApiPropertyOptional({ description: '月 token 上限' })
  @IsOptional()
  @IsInt()
  @Min(1)
  limitMonthly?: number;

  @ApiPropertyOptional({ type: [String], description: '可用渠道白名单' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  providerIds?: string[];
}
