import { describe, expect, it } from 'vitest';

import { validarEntorno } from '../../src/config/entorno.js';

const minimo = { DATABASE_URL: 'postgres://u:p@localhost:5432/parkia' };

describe('validarEntorno', () => {
  it('aplica valores por defecto', () => {
    expect(validarEntorno(minimo)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: minimo.DATABASE_URL,
      DATABASE_POOL_MAX: 10,
      CORS_ORIGINS: [],
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
    expect(() => validarEntorno({})).toThrow(/DATABASE_URL/);
  });

  it('rechaza URLs que no son de PostgreSQL', () => {
    expect(() => validarEntorno({ DATABASE_URL: 'mysql://localhost/parkia' })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rechaza puertos inválidos', () => {
    expect(() => validarEntorno({ ...minimo, PORT: '99999' })).toThrow(/PORT/);
  });
});
