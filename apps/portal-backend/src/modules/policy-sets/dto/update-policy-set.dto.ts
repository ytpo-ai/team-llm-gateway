import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { PolicyEntryDto } from './policy-entry.dto.js';

export class UpdatePolicySetDto {
  @ApiPropertyOptional({ example: '研发默认' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: [PolicyEntryDto], description: '用量限制条目' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PolicyEntryDto)
  entries?: PolicyEntryDto[];

  @ApiPropertyOptional({
    type: [String],
    description: '可用渠道白名单（空 = 全部）',
  })
  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  providerIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: '可用模型白名单（空 = 全部）',
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  modelWhitelist?: string[];
}
