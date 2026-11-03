import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateApiKeyDto {
  @ApiPropertyOptional({ description: '改绑成员 ID（team_admin 可指定）' })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: '我的开发密钥' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '2027-01-01T00:00:00.000Z', nullable: true })
  @IsOptional()
  @IsDateString()
  expiresAt?: string | null;

  @ApiPropertyOptional({ description: '绑定策略集 ID（null/空 = 不限）', nullable: true })
  @IsOptional()
  @IsMongoId()
  policySetId?: string | null;
}
