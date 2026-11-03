import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
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

  @ApiPropertyOptional({
    description: '绑定策略集 ID（空 = 不限）',
  })
  @IsOptional()
  @IsMongoId()
  policySetId?: string;
}
