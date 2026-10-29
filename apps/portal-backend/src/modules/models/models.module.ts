import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { Provider, ProviderSchema } from '../providers/schemas/provider.schema.js';
import { SystemModule } from '../system/system.module.js';
import { ModelsController } from './models.controller.js';
import { ModelsService } from './models.service.js';
import { Model, ModelSchema } from './schemas/model.schema.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SystemModule,
    MongooseModule.forFeature([
      { name: Model.name, schema: ModelSchema },
      { name: Provider.name, schema: ProviderSchema },
    ]),
  ],
  controllers: [ModelsController],
  providers: [ModelsService],
  exports: [ModelsService],
})
export class ModelsModule {}
