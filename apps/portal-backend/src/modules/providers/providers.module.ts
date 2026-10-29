import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AuthModule } from '../auth/auth.module.js';
import { SystemModule } from '../system/system.module.js';
import { ProvidersController } from './providers.controller.js';
import { ProvidersService } from './providers.service.js';
import { Provider, ProviderSchema } from './schemas/provider.schema.js';

@Module({
  imports: [
    forwardRef(() => AuthModule),
    SystemModule,
    MongooseModule.forFeature([{ name: Provider.name, schema: ProviderSchema }]),
  ],
  controllers: [ProvidersController],
  providers: [ProvidersService],
  exports: [ProvidersService],
})
export class ProvidersModule {}
