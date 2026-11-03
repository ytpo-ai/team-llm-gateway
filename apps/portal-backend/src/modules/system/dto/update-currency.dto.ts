import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class CurrencyRateDto {
  @ApiProperty({ example: 'USD', description: '币种代码（如 USD/CNY）' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty({ example: '美元', description: '币种名称' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    example: 10000,
    description: '1 货币单位对应的点数（如 10000 点 = $1）',
  })
  @IsNumber()
  @Min(0.000001)
  pointsPerUnit: number;
}

export class UpdateCurrencyDto {
  @ApiProperty({
    example: 'CNY',
    description: '默认展示货币 code，必须存在于 rates 中',
  })
  @IsString()
  @IsNotEmpty()
  displayCurrency: string;

  @ApiProperty({ type: [CurrencyRateDto], description: '多币种汇率列表' })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => CurrencyRateDto)
  rates: CurrencyRateDto[];
}
