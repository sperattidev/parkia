import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { Entorno } from '../config/entorno.js';
import { CorreoConsola } from './correo-consola.js';
import { CorreoResend } from './correo-resend.js';
import { Correo } from './correo.js';

@Global()
@Module({
  providers: [
    {
      provide: Correo,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Entorno, true>): Correo => {
        const apiKey = config.get('RESEND_API_KEY', { infer: true });
        return config.get('CORREO_PROVEEDOR', { infer: true }) === 'resend' && apiKey
          ? new CorreoResend(apiKey, config.get('CORREO_REMITENTE', { infer: true }))
          : new CorreoConsola();
      },
    },
  ],
  exports: [Correo],
})
export class CorreoModule {}
