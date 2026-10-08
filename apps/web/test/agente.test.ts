import { describe, expect, it } from 'vitest';

import { hace, minutosEntre } from '@/componentes/agente/piezas';

const zona = 'America/Argentina/Buenos_Aires';
const ahora = new Date('2026-10-05T13:00:00Z');

describe('hace', () => {
  it('describe el tiempo transcurrido como lo diría un agente', () => {
    expect(hace('2026-10-05T12:59:40Z', ahora, zona)).toBe('recién');
    expect(hace('2026-10-05T12:48:00Z', ahora, zona)).toBe('hace 12 min');
    expect(hace('2026-10-05T11:00:00Z', ahora, zona)).toBe('hace 2 h');
  });

  it('pasadas 3 horas muestra la hora local', () => {
    expect(hace('2026-10-05T09:30:00Z', ahora, zona)).toBe('a las 06:30');
  });
});

describe('minutosEntre', () => {
  it('redondea hacia abajo y respeta el signo', () => {
    expect(minutosEntre(new Date('2026-10-05T12:50:30Z'), ahora)).toBe(9);
    expect(minutosEntre(ahora, new Date('2026-10-05T12:50:00Z'))).toBe(-10);
  });
});
