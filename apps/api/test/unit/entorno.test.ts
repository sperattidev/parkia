import { describe, expect, it } from 'vitest';

import { admiteCargasDePrueba, validarEntorno } from '../../src/config/entorno.js';

const minimo = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/parkia',
  AUTH_SECRET: 'x'.repeat(32),
};

describe('validarEntorno', () => {
  it('aplica valores por defecto', () => {
    expect(validarEntorno(minimo)).toEqual({
      NODE_ENV: 'development',
      PARKIA_ENTORNO: 'desarrollo',
      PARKIA_SIMULACION: false,
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: minimo.DATABASE_URL,
      DATABASE_POOL_MAX: 10,
      CORS_ORIGINS: [],
      AUTH_SECRET: minimo.AUTH_SECRET,
      CORREO_PROVEEDOR: 'consola',
      CORREO_REMITENTE: 'Parkia <no-responder@parkia.net.ar>',
    });
  });

  it('separa los orígenes CORS', () => {
    expect(
      validarEntorno({
        ...minimo,
        CORS_ORIGINS: 'https://app.parkia.net.ar, https://gestion.parkia.net.ar,',
      }).CORS_ORIGINS,
    ).toEqual(['https://app.parkia.net.ar', 'https://gestion.parkia.net.ar']);
  });

  it('falla con un mensaje claro si falta la base de datos', () => {
    expect(() => validarEntorno({ AUTH_SECRET: minimo.AUTH_SECRET })).toThrow(/DATABASE_URL/);
  });

  it('rechaza URLs que no son de PostgreSQL', () => {
    expect(() => validarEntorno({ ...minimo, DATABASE_URL: 'mysql://localhost/parkia' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rechaza puertos inválidos', () => {
    expect(() => validarEntorno({ ...minimo, PORT: '99999' })).toThrow(/PORT/);
  });

  it('exige una clave de autenticación robusta', () => {
    expect(() => validarEntorno({ ...minimo, AUTH_SECRET: 'corta' })).toThrow(/AUTH_SECRET/);
  });

  it('en producción exige un proveedor de correo real', () => {
    expect(() => validarEntorno({ ...minimo, PARKIA_ENTORNO: 'produccion' })).toThrow(
      /CORREO_PROVEEDOR/,
    );
    // La demo corre como producción técnica pero puede mostrar los códigos en el log.
    expect(
      validarEntorno({ ...minimo, NODE_ENV: 'production', PARKIA_ENTORNO: 'demo' })
        .CORREO_PROVEEDOR,
    ).toBe('consola');
  });

  it('nunca habilita la actividad simulada en producción', () => {
    const produccion = {
      ...minimo,
      PARKIA_ENTORNO: 'produccion',
      CORREO_PROVEEDOR: 'resend',
      RESEND_API_KEY: 're_123',
    };
    expect(() => validarEntorno({ ...produccion, PARKIA_SIMULACION: 'true' })).toThrow(
      /PARKIA_SIMULACION/,
    );
    expect(validarEntorno(produccion).PARKIA_SIMULACION).toBe(false);
    expect(
      validarEntorno({ ...minimo, PARKIA_ENTORNO: 'demo', PARKIA_SIMULACION: 'true' })
        .PARKIA_SIMULACION,
    ).toBe(true);
  });

  it('con Resend exige la API key', () => {
    expect(() => validarEntorno({ ...minimo, CORREO_PROVEEDOR: 'resend' })).toThrow(
      /RESEND_API_KEY/,
    );
    expect(
      validarEntorno({ ...minimo, CORREO_PROVEEDOR: 'resend', RESEND_API_KEY: 're_123' })
        .CORREO_PROVEEDOR,
    ).toBe('resend');
  });
});

describe('admiteCargasDePrueba', () => {
  it('solo las prohíbe en producción', () => {
    expect(admiteCargasDePrueba({ PARKIA_ENTORNO: 'desarrollo' })).toBe(true);
    expect(admiteCargasDePrueba({ PARKIA_ENTORNO: 'demo' })).toBe(true);
    expect(admiteCargasDePrueba({ PARKIA_ENTORNO: 'produccion' })).toBe(false);
  });
});
