import { describe, expect, it } from 'vitest';

import { ipDelCliente } from '../../src/comun/ip-cliente.js';

describe('ipDelCliente', () => {
  it('usa la IP que informa Cloudflare', () => {
    expect(ipDelCliente({ ip: '10.0.0.5', headers: { 'cf-connecting-ip': '181.1.2.3' } })).toBe(
      '181.1.2.3',
    );
  });

  it('sin Cloudflare usa la IP de la conexión', () => {
    expect(ipDelCliente({ ip: '127.0.0.1', headers: {} })).toBe('127.0.0.1');
    expect(ipDelCliente({ ip: '127.0.0.1', headers: { 'cf-connecting-ip': '  ' } })).toBe(
      '127.0.0.1',
    );
  });
});
