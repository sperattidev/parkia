import type { FastifyRequest } from 'fastify';

/**
 * IP real del cliente. En producción todo el tráfico entra por Cloudflare, que
 * fija `CF-Connecting-IP` (un cliente no puede falsificarla); la web la reenvía
 * al llamar a la API desde su servidor. Sin Cloudflare (desarrollo), la IP directa.
 */
export function ipDelCliente(solicitud: Pick<FastifyRequest, 'headers' | 'ip'>): string {
  const cloudflare = solicitud.headers['cf-connecting-ip'];
  return (typeof cloudflare === 'string' && cloudflare.trim()) || solicitud.ip;
}
