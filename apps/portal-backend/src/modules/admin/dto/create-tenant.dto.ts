import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTenantDto {
  @ApiProperty({ example: 'acme', description: '租户编码（唯一）' })
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  code: string;

  @ApiProperty({ example: 'Acme 团队' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
