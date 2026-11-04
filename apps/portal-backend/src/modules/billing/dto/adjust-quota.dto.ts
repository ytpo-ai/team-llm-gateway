import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AdjustQuotaDto {
  @ApiProperty({ example: -500, description: '正=加额度，负=减额度' })
  @IsNumber()
  amount: number;

  @ApiPropertyOptional({
    description: '目标团队 ID（system 可指定任意团队，team_admin 仅限本团队）',
    example: '64f1c9e2a1b2c3d4e5f6a7b8',
  })
  @IsOptional()
  @IsMongoId()
  teamId?: string;

  @ApiPropertyOptional({
    description: '缺省 = 团队账户；指定 = 成员账户',
    example: '64f1c9e2a1b2c3d4e5f6a7b8',
  })
  @IsOptional()
  @IsMongoId()
  userId?: string;

  @ApiPropertyOptional({ example: '人工修正' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  description?: string;
}
