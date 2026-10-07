import { describe, expect, it } from 'vitest';

import { reglaTarifariaZonaSchema } from '../src/index.js';

const reglaValida = {
  horario: [{ dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '20:00' }],
  fraccionMinutos: 15,
  minimoMinutos: 30,
  toleranciaMinutos: 5,
  tramos: [{ desdeMinuto: 0, precioHora: 100_000 }],
};

describe('reglaTarifariaZonaSchema', () => {
  it('acepta una regla válida', () => {
    expect(reglaTarifariaZonaSchema.safeParse(reglaValida).success).toBe(true);
  });

  it('rechaza tipos incorrectos con el error de Zod', () => {
    const resultado = reglaTarifariaZonaSchema.safeParse({ ...reglaValida, fraccionMinutos: '15' });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]?.path).toEqual(['fraccionMinutos']);
  });

  it('delega la coherencia al dominio y expone su código', () => {
    const resultado = reglaTarifariaZonaSchema.safeParse({ ...reglaValida, minimoMinutos: 20 });
    expect(resultado.success).toBe(false);
    expect(resultado.error?.issues[0]).toMatchObject({
      code: 'custom',
      params: { codigo: 'MINIMO_INVALIDO' },
    });
  });

  it('rechaza importes con decimales', () => {
    const resultado = reglaTarifariaZonaSchema.safeParse({
      ...reglaValida,
      tramos: [{ desdeMinuto: 0, precioHora: 1000.5 }],
    });
    expect(resultado.success).toBe(false);
  });

  it('se puede exportar como JSON Schema para documentar la API', () => {
    const esquema = reglaTarifariaZonaSchema['~standard'].jsonSchema.input({
      target: 'draft-2020-12',
    });
    // Con `id`, el esquema se publica como componente reutilizable.
    expect(esquema).toMatchObject({
      $defs: {
        ReglaTarifariaZona: {
          type: 'object',
          required: expect.arrayContaining(['tramos']) as unknown,
        },
      },
    });
  });
});
