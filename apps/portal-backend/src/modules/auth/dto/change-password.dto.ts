import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'old-password' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  oldPassword: string;

  @ApiProperty({ example: 'new-password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword: string;
}
