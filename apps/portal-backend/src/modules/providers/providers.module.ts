import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { ModelsModule } from '../models/models.module.js';
import { SystemModule } from '../system/system.module.js';
import { UsageModule } from '../usage/usage.module.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';
import { Provider, ProviderSchema } from './schemas/provider.schema.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SystemModule,
    ModelsModule,
    UsageModule,
    MongooseModule.forFeature([{ name: Provider.name, schema: ProviderSchema }]),
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
