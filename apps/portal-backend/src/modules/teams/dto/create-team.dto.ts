import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class CreateTeamDto {
  @ApiProperty({ example: '研发组' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;
}
