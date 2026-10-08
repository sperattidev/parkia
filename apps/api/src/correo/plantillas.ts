import type { MensajeDeCorreo } from './correo.js';

/**
 * Plantillas de email. Cada mensaje va en HTML (con estilos en línea y
 * tablas, lo único que respetan Gmail y Outlook) y en texto plano, para los
 * clientes que no muestran HTML y para los filtros de spam.
 */

const MARCA = '#2754E6';

function escapar(texto: string): string {
  return texto
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Estructura común: marca, contenido y pie. `contenido` ya viene escapado. */
function plantilla(titulo: string, previa: string, contenido: string): string {
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${escapar(titulo)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f6fb;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapar(previa)}</span>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb;">
<tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:480px;background:#ffffff;border-radius:20px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0d1729;">
<tr><td style="padding:28px 32px 0;">
<table role="presentation" cellspacing="0" cellpadding="0"><tr>
<td style="width:36px;height:36px;border-radius:10px;background:${MARCA};color:#ffffff;font-weight:800;font-size:20px;text-align:center;line-height:36px;">P</td>
<td style="padding-left:10px;font-size:20px;font-weight:800;letter-spacing:-0.3px;">Parkia</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 32px 32px;">${contenido}</td></tr>
</table>
<p style="max-width:480px;margin:16px auto 0;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:12px;line-height:18px;color:#8a97ab;text-align:center;">
Parkia · Estacionamiento medido<br>Este mensaje se envió automáticamente; no hace falta responderlo.
</p>
</td></tr>
</table>
</body>
</html>`;
}

/** Código de ingreso de 6 dígitos para conductores. */
export function correoDeCodigo(
  para: string,
  codigo: string,
  minutosDeVigencia: number,
): MensajeDeCorreo {
  const vigencia = `Vence en ${String(minutosDeVigencia)} minutos.`;
  const contenido = `
<h1 style="margin:0 0 8px;font-size:22px;line-height:28px;font-weight:800;">Tu código para ingresar</h1>
<p style="margin:0 0 24px;font-size:15px;line-height:22px;color:#56657d;">Escribilo en la pantalla de ingreso de Parkia.</p>
<div style="margin:0 0 24px;padding:18px 0;border-radius:14px;background:#e9efff;text-align:center;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:34px;font-weight:700;letter-spacing:10px;color:#0f2a7a;">${escapar(codigo)}</div>
<p style="margin:0;font-size:14px;line-height:21px;color:#56657d;">${vigencia} Si no lo pediste, ignorá este mensaje: nadie puede ingresar sin el código.</p>`;
  return {
    para,
    asunto: `Tu código de Parkia: ${codigo}`,
    texto: [
      `Tu código para ingresar a Parkia es: ${codigo}`,
      '',
      `${vigencia} Si no lo pediste, ignorá este mensaje.`,
    ].join('\n'),
    html: plantilla(
      'Tu código de Parkia',
      `${codigo} es tu código para ingresar. ${vigencia}`,
      contenido,
    ),
  };
}
