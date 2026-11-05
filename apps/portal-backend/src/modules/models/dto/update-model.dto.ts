import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { ModelStatus } from '../schemas/model.schema.js';
import { ProviderBindingDto } from './create-model.dto.js';

export class UpdateModelDto {
  @ApiPropertyOptional({ example: '64f1c2a3b4d5e6f7a8b9c0d1' })
  @IsOptional()
  @IsMongoId()
  providerId?: string;

  @ApiPropertyOptional({
    type: [ProviderBindingDto],
    description: '额外渠道绑定（含优先级）',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProviderBindingDto)
  providerBindings?: ProviderBindingDto[];

  @ApiPropertyOptional({ example: 'gpt-4o-mini' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  modelId?: string;

  @ApiPropertyOptional({ example: 'GPT-4o mini' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  displayName?: string;

  @ApiPropertyOptional({ example: 1.5 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  capabilities?: string[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  aliases?: string[];

  @ApiPropertyOptional({ enum: ModelStatus })
  @IsOptional()
  @IsEnum(ModelStatus)
  status?: ModelStatus;
}
