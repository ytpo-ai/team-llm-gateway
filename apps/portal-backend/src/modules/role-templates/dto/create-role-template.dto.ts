import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateRoleTemplateDto {
  @ApiProperty({ example: '设计师' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '设计团队常用模型配置' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ description: '日 token 上限（null 不限）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limitDaily?: number;

  @ApiPropertyOptional({ description: '周 token 上限（null 不限）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limitWeekly?: number;

  @ApiPropertyOptional({ description: '月 token 上限（null 不限）' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  limitMonthly?: number;

  @ApiPropertyOptional({ description: '每分钟速率上限' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({ type: [String], description: '可用渠道白名单（空 = 全部）' })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  providerIds?: string[];

  @ApiPropertyOptional({ type: [String], description: '可用模型白名单（空 = 全部）' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modelWhitelist?: string[];
}
