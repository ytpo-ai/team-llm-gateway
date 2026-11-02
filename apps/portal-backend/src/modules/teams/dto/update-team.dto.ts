import { ApiPropertyOptional } from '@nestjs/swagger';
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

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: '研发一组' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

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

  @ApiPropertyOptional({
    type: [String],
    description: '可用渠道白名单（空 = 全部）',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  providerIds?: string[];
}
