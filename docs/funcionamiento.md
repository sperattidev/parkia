# Parkia — Cómo funciona el estacionamiento

Reglas operativas del sistema, en lenguaje llano. Complementa [tarifas.md](tarifas.md) (cálculo del importe). Sirve como base para la ordenanza y para capacitar al personal municipal.

## Cuentas

| Quién                       | Cómo ingresa                                                                          | Qué puede hacer                                                                                     |
| --------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| **Conductor**               | Con su email: recibe un código de 6 dígitos (sin contraseña). La sesión dura 30 días. | Registrar hasta 10 vehículos, cargar saldo, iniciar y finalizar estacionamientos, ver su historial. |
| **Agente de control**       | Email y contraseña asignados por el municipio. La sesión dura una jornada (12 h).     | Verificar patentes en la calle.                                                                     |
| **Administrador municipal** | Email y contraseña.                                                                   | Todo lo del agente (y, en próximas versiones, gestión de zonas, tarifas y reportes).                |

Una misma cuenta de conductor sirve en todos los municipios que usen Parkia.

## Saldo

- El saldo es **prepago y por municipio**: lo que se carga en Firmat se acredita en la cuenta de la Municipalidad de Firmat y solo paga estacionamiento en Firmat.
- El saldo **nunca puede quedar negativo**.
- Cada carga y cada cobro queda en un **libro de movimientos que no se puede modificar ni borrar**, ni siquiera desde la base de datos. Las correcciones se registran como movimientos nuevos (reintegro o ajuste), así el historial siempre es auditable.

## Zonas y cuadras

- El estacionamiento medido se define **por cuadra**, no por áreas dibujadas: cada cuadra es el tramo de una calle entre dos esquinas, con su rango de alturas (por ejemplo, Sarmiento 700–799).
- Una **zona** (Microcentro, La Quemada…) agrupa cuadras con la misma tarifa y horario. Al incluir una manzana se incluyen todas las cuadras que la rodean: 4 en una manzana común, 3 en una triangular.
- Cada cuadra tiene **dos manos** (par e impar) con su **capacidad** estimada: cuántos autos entran sobre ese lado. Si sobre una mano no se puede estacionar, su capacidad es 0.
- Opcionalmente, una cuadra puede tener **lugares numerados** (pintados en el cordón). En ese caso el conductor elige el número de su lugar y nadie más puede ocuparlo mientras su estacionamiento esté en curso.

> El GPS de un celular tiene un error típico de 5 a 15 metros: alcanza para saber la cuadra, la mano y una altura aproximada, pero no para distinguir un lugar de otro. Por eso el número de lugar lo indica el conductor y solo existe donde el municipio numera los lugares.

## Estacionar

1. La app detecta por GPS la **cuadra, la mano y la altura** (por ejemplo, _Sarmiento 750, mano par_); el conductor puede corregirla tocando otra cuadra en el mapa o cambiando de mano. En cuadras con lugares numerados elige además su lugar. Después elige la patente.
2. **Si en ese momento se cobra**, el saldo tiene que alcanzar al menos para el tiempo mínimo. Fuera del horario de cobro se puede iniciar igual.
3. Parkia calcula **hasta qué hora cubre el saldo** (vencimiento) y se lo muestra al conductor.
4. **Cargar saldo durante el estacionamiento extiende el vencimiento.**
5. Al **finalizar**, se cobra solo el tiempo usado, según la tarifa.
6. **Si el saldo se agota**, el estacionamiento se cierra automáticamente al vencimiento y se cobra hasta ese momento. Desde ahí el vehículo figura como _vencido_ para los agentes.

**Reglas de protección:**

- **Tarifa congelada:** se cobra con la tarifa vigente al momento de iniciar, aunque el municipio la cambie durante la estadía.
- Una patente no puede tener dos estacionamientos en curso a la vez en el mismo municipio.
- Una cuenta tiene un estacionamiento en curso por municipio. Para estacionar otro vehículo, primero se finaliza el actual.
- Finalizar dos veces no cobra dos veces.
- Ningún estacionamiento dura más de 7 días.

## Control en la calle

El agente ingresa (o escanea) la patente. Parkia usa su ubicación GPS para saber en qué cuadra está y responde con el resultado y, si hay un estacionamiento en curso, **dónde lo declaró el conductor** (por ejemplo, _Avenida Santa Fe 751 · mano impar · lugar 7_):

| Resultado             | ¿Habilitado? | Significado                                                |
| --------------------- | ------------ | ---------------------------------------------------------- |
| `habilitado`          | ✅ Sí        | Tiene un estacionamiento vigente en esta zona.             |
| `fuera_de_horario`    | ✅ Sí        | En este momento no se cobra en la zona.                    |
| `sin_estacionamiento` | ❌ No        | No tiene un estacionamiento en curso.                      |
| `vencido`             | ❌ No        | Tenía un estacionamiento, pero se agotó el saldo.          |
| `otra_zona`           | ❌ No        | Pagó en otra zona tarifada.                                |
| `fuera_de_zona`       | —            | La ubicación del agente no está sobre una cuadra tarifada. |

**Cada verificación queda registrada** con agente, patente, ubicación, hora y resultado. Es la base para el labrado de actas (próxima versión) y para auditar la tarea de control.

## Próximas versiones

- Carga de saldo con Mercado Pago (hoy: cargas de prueba en entornos de desarrollo).
- Actas de infracción con foto y envío al Juzgado de Faltas.
- Exenciones (discapacidad, frentistas, vehículos oficiales) y abonos.
- Puntos de venta en comercios.
- Gestión de zonas, cuadras y tarifas desde el panel municipal (eligiendo manzanas en el mapa).
