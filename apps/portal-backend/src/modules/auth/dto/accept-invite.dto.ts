import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class AcceptInviteDto {
  @ApiProperty({ description: '邀请 token（邀请链接中携带）' })
  @IsString()
  @MinLength(1)
  token: string;

  @ApiProperty({ example: '张三' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'password123', minLength: 8 })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;
}
