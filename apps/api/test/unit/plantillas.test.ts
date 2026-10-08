import { describe, expect, it } from 'vitest';

import { correoDeCodigo } from '../../src/correo/plantillas.js';

describe('correoDeCodigo', () => {
  const mensaje = correoDeCodigo('vecina@ejemplo.com', '482913', 10);

  it('pone el código en el asunto, el texto y el HTML', () => {
    expect(mensaje).toMatchObject({
      para: 'vecina@ejemplo.com',
      asunto: 'Tu código de Parkia: 482913',
    });
    expect(mensaje.texto).toContain('Tu código para ingresar a Parkia es: 482913');
    expect(mensaje.texto).toContain('Vence en 10 minutos.');
    expect(mensaje.html).toContain('>482913</div>');
  });

  it('incluye el texto de vista previa que muestran las bandejas de entrada', () => {
    expect(mensaje.html).toContain('482913 es tu código para ingresar. Vence en 10 minutos.');
  });

  it('escapa lo que se inserta en el HTML', () => {
    expect(correoDeCodigo('a@b.c', '<b>1</b>', 10).html).toContain('&lt;b&gt;1&lt;/b&gt;');
  });
});
