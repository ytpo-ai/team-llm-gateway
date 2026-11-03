import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTeamDto {
  @ApiPropertyOptional({ example: '研发一组' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    description: '绑定策略集 ID（null/空 = 不限）',
    nullable: true,
  })
  @IsOptional()
  @IsMongoId()
  policySetId?: string | null;
}
