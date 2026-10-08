# Parkia — Estado del producto y pendientes

> Actualizado el 8/10/2026. En demostración: <https://app.parkia.net.ar/firmat> (conductor) y <https://app.parkia.net.ar/personal/ingresar> (agentes, panel municipal y equipo de Parkia), con `PARKIA_ENTORNO=demo`: el saldo es de prueba y no se cobra dinero real.

## Lo que está hecho

### App del conductor (PWA)

- Ingreso con código de 6 dígitos por email, sin contraseña. Sesión de 30 días.
- Hasta 10 vehículos por cuenta, con validación de patentes argentinas (autos y motos, formato 1995 y Mercosur).
- **Estacionar por cuadra:** el GPS detecta cuadra, mano y altura (_Sarmiento 750, mano par_); se puede corregir tocando otra cuadra. En cuadras con lugares numerados se elige el lugar y los ocupados aparecen bloqueados. Se ve cuántos lugares libres quedan por mano.
- Tarifa y horario de la zona antes de estacionar, vencimiento según el saldo, cobro solo del tiempo usado, cierre automático al agotarse el saldo.
- Saldo por municipio con movimientos, historial de estacionamientos con la dirección.
- Diseño propio en modo claro y oscuro, mapa con las cuadras pagas coloreadas por zona.

### App de control (`/agente`)

- Ingreso del personal con email y contraseña. Sesión de una jornada.
- **Ronda:** el padrón de la cuadra donde está el agente, por mano, con la grilla de lugares numerados. Un vehículo estacionado que no figura está sin pagar.
- **Radar:** vencidos de las últimas 2 horas y por vencer, los más cercanos y los que nadie controló primero.
- **Control:** veredicto con color y vibración, motivo, ubicación declarada por el conductor y si coincide con la cuadra del agente, aviso si la patente ya se controló.
- **Cobertura:** el mapa marca las cuadras que el equipo todavía no controló hoy. **Jornada:** controles, infracciones y porcentaje en regla.

### Panel municipal (`/gestion`)

- **Resumen** del período: recaudado, saldo cargado, estacionamientos, duración promedio, ocupación ahora y controles, con gráficos por día, por hora y por zona.
- **Ocupación** en vivo: mapa con las cuadras coloreadas por cuán llenas están y ranking de las más ocupadas.
- **Estacionamientos y controles** con filtros y **exportación a Excel**.
- **Zonas y tarifas** con vista previa de cuánto pagaría un conductor mientras se edita; **cuadras** asignadas a zonas «pintándolas» en el mapa, con capacidad por mano y lugares numerados.
- **Personal:** altas con contraseña temporal, roles, bajas y restablecimientos.
- **Auditoría** inmutable de cada cambio, con quién, cuándo y el antes y después.

### Panel de Parkia (`/plataforma`)

- Municipios clientes con sus indicadores, alta de un municipio junto con su primer administrador y activación o desactivación.
- El equipo de Parkia puede entrar al panel de cualquier municipio para dar soporte.

### Demo

- **Simulador de actividad** (solo en demo y desarrollo): conductores ficticios que estacionan con las reglas reales, para que padrón, radar, ocupación y reportes muestren movimiento ([despliegue.md](despliegue.md#actividad-simulada-solo-demo)).

### Núcleo (API y dominio)

- Motor de tarifas por zona: franjas horarias, días, feriados, fracción, mínimo, tolerancia, tramos progresivos y tope por jornada, con la tarifa congelada al iniciar ([tarifas.md](tarifas.md)).
- Zonas formadas por **cuadras** reales (30 cuadras de Firmat tomadas de OpenStreetMap), con alturas, capacidad por mano y lugares numerados opcionales.
- Billetera con movimientos **inmutables** (ni la base permite modificarlos), sin saldo negativo.
- Control con reglas puras y testeadas: vencidos visibles toda la jornada, tolerancia en las esquinas entre zonas, registro de cada control con cuadra, ubicación y precisión del GPS.
- Seguridad: tokens y códigos guardados como HMAC, contraseñas con scrypt, contraseñas temporales que se cambian al primer ingreso, límites de intentos por IP, roles por municipio y de plataforma, cookie `httpOnly` y protección CSRF en la web.
- Documentación OpenAPI en `api.parkia.net.ar/docs`.

### Calidad e infraestructura

- TypeScript estricto en todo el monorepo; 115 tests de dominio, 122 de integración contra PostGIS real (cada archivo con su propia base) y tests unitarios en API, contratos y web. CI en GitHub Actions en cada push.
- VPS propia aislada de los otros proyectos, Cloudflare Tunnel sin puertos abiertos, despliegue con un comando que conserva la versión anterior para volver atrás.
- Respaldo diario de la base en la VPS, con restauración probada.

## Lo que falta

### 1. Para mostrar la demo sin depender de mí (corto plazo)

| Pendiente                                     | Por qué importa                                                                                                                                                   |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Emails reales con Resend**                  | Hoy en la demo el código de ingreso aparece solo en el log del servidor: nadie del municipio puede entrar solo. Requiere cuenta de Resend y verificar el dominio. |
| **Cuenta del equipo de Parkia en producción** | Se crea una sola vez con el comando de [despliegue.md](despliegue.md#personal); desde ahí se da de alta todo lo demás en los paneles.                             |
| **Textos que prometen de más**                | El ingreso dice «Te avisamos antes de que venza», pero los avisos todavía no existen. Hay que implementarlos o quitar la frase.                                   |
| **Propuesta comercial**                       | Documento y presentación para la Municipalidad de Firmat (precio, modelo, cronograma del piloto), basados en [mercado.md](mercado.md).                            |

### 2. Para el piloto con cobro real en Firmat

| Pendiente                                      | Detalle                                                                                                                                                                             |
| ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carga de saldo con Mercado Pago**            | Cuenta del municipio conectada por OAuth (la plata va directo al municipio), webhooks, conciliación y reintegros.                                                                   |
| **Actas de infracción**                        | Foto, ubicación, hash, numeración y estados, con exportación para el Juzgado de Faltas. Necesita ordenanza o convenio que las respalde.                                             |
| **Avisos al conductor**                        | «Te quedan 10 minutos» por email o notificación web; luego WhatsApp.                                                                                                                |
| **Exenciones y abonos**                        | Personas con discapacidad, frentistas, vehículos oficiales: el control debe darlos por habilitados.                                                                                 |
| **Datos reales de Firmat**                     | Cuadras incluidas, numeración, capacidad por mano, lugares numerados y tarifa según la ordenanza. Hoy son valores de demostración.                                                  |
| **Respaldos fuera del servidor**               | Copia diaria a Cloudflare R2 y prueba mensual. Hoy, si falla el disco de la VPS, se pierden los datos.                                                                              |
| **Monitoreo**                                  | Aviso externo si se cae el sitio y seguimiento de errores (Sentry).                                                                                                                 |
| **Aislamiento por municipio en la base (RLS)** | Hoy cada consulta filtra por municipio en el código; con RLS lo garantiza también la base. Imprescindible antes del segundo municipio.                                              |
| **Recuperación de contraseña y 2FA**           | Hoy una persona que olvida su contraseña depende de que un administrador se la restablezca; falta recuperarla por email (requiere Resend) y un segundo factor para administradores. |
| **Legales**                                    | Términos y condiciones, política de privacidad y registro de la base de datos personales (Ley 25.326), contrato con el municipio.                                                   |

### 3. Después del piloto

- **App nativa del agente** (Expo): lectura de patentes con la cámara y funcionamiento sin señal.
- **Dibujar cuadras nuevas** en el panel (hoy se importan de OpenStreetMap y el panel asigna las existentes).
- **Puntos de venta** en comercios para quien no usa el celular.
- **Tablero público de transparencia:** recaudación y ocupación en tiempo real.
- Estacionar por **WhatsApp**.
- Despliegue desde GitHub Actions (sin depender de una PC), tests end-to-end con Playwright y un segundo servidor en espera.
- Facturación electrónica (ARCA) de la comisión de Parkia.

## Limitaciones conocidas

- **Un solo servidor.** Aceptable para el piloto solo con respaldos fuera de la VPS (pendiente).
- **El lugar numerado lo declara el conductor:** el GPS no tiene precisión para distinguir un lugar de otro. El agente lo verifica mirando el número pintado en el cordón.
- **Una sesión por navegador:** si en el mismo navegador se ingresa como conductor y como agente, la segunda sesión reemplaza a la primera.
- **Reportes por medio de pago:** llegan con Mercado Pago; hoy todo el saldo es de prueba.
