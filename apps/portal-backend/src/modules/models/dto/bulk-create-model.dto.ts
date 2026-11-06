import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BulkModelItemDto {
  @ApiProperty({ example: 'gpt-4o-mini' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  modelId: string;

  @ApiPropertyOptional({ example: 'GPT-4o mini' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({ example: 'OpenAI 多模态旗舰模型，支持文本与图像输入' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ example: 128000, description: '上下文长度（tokens）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  contextLength?: number;

  @ApiPropertyOptional({ example: 16384, description: '最大输出长度（tokens）' })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOutputLength?: number;

  @ApiPropertyOptional({ type: [String], example: ['text', 'image'], description: '输入模态' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  inputModalities?: string[];

  @ApiPropertyOptional({ type: [String], example: ['text'], description: '输出模态' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  outputModalities?: string[];

  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @ApiPropertyOptional({ type: [String], example: ['chat', 'code'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @ApiPropertyOptional({ type: [String], example: ['gpt-4o'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];
}

export class BulkCreateModelDto {
  @ApiProperty({ description: '归属上游渠道 ID' })
  @IsMongoId()
  providerId: string;

  @ApiProperty({ type: [BulkModelItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => BulkModelItemDto)
  models: BulkModelItemDto[];
}
