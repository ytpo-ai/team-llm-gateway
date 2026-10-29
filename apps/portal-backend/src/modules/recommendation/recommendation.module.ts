import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Model, ModelSchema } from '../models/schemas/model.schema.js';
import { RecommendationController } from './recommendation.controller.js';
import { RecommendationService } from './recommendation.service.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    MongooseModule.forFeature([{ name: Model.name, schema: ModelSchema }]),
  ],
  controllers: [RecommendationController],
  providers: [RecommendationService],
})
export class RecommendationModule {}
