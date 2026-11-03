import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateRoleTemplateDto {
  @ApiPropertyOptional({ example: '设计师' })
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

  @ApiPropertyOptional({
    description: '绑定策略集 ID（null/空 = 不限）',
    nullable: true,
  })
  @IsOptional()
  @IsMongoId()
  policySetId?: string | null;
}
