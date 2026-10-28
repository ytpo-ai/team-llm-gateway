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

export class CreateModelDto {
  @ApiProperty({ example: '64f1c2a3b4d5e6f7a8b9c0d1', description: '归属上游渠道 ID' })
  @IsMongoId()
  providerId: string;

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

  @ApiPropertyOptional({ example: 1.5, default: 1 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @ApiPropertyOptional({ type: [String], example: ['chat', 'cheap'] })
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
