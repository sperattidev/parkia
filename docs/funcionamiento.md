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

Los agentes usan la app de control (`/agente`), con el email y la contraseña que les asigna el municipio. La sesión dura una jornada.

### La ronda, cuadra por cuadra

En lugar de tipear patente por patente, el agente trabaja con lo que los conductores **declararon** al estacionar:

- **Padrón de la cuadra.** Al caminar, el GPS detecta la cuadra y muestra, por mano, los vehículos que pagaron (patente, altura, lugar y hasta qué hora) y los que se quedaron sin saldo. **Un vehículo estacionado que no figura en el padrón está sin pagar.** En cuadras con lugares numerados se ve la grilla: verde pagado, rojo vencido, punteado sin pago.
- **Radar.** Lista de los vehículos que se quedaron sin saldo en las últimas 2 horas y de los que vencen en menos de 10 minutos, los más cercanos primero. Los que nadie controló desde que vencieron van adelante.
- **Cobertura.** El mapa muestra tenues las cuadras que nadie del equipo controló hoy, para repartir la recorrida.
- **Jornada.** Resumen del día: controles, infracciones, porcentaje en regla y últimos controles.

### Resultado de un control

El agente ingresa la patente (o la elige del padrón o del radar). Parkia usa su ubicación para saber en qué cuadra está y responde:

| Resultado             | ¿Habilitado? | Significado                                                                            |
| --------------------- | ------------ | -------------------------------------------------------------------------------------- |
| `habilitado`          | ✅ Sí        | Tiene un estacionamiento vigente en esta zona.                                         |
| `fuera_de_horario`    | ✅ Sí        | En este momento no se cobra en la zona.                                                |
| `sin_estacionamiento` | ❌ No        | No pagó hoy, o finalizó su estacionamiento y sigue estacionado.                        |
| `vencido`             | ❌ No        | Se le agotó el saldo durante la jornada y no volvió a pagar (con hora de vencimiento). |
| `otra_zona`           | ❌ No        | Pagó en otra zona tarifada.                                                            |
| `fuera_de_zona`       | —            | La ubicación del agente no está sobre una cuadra tarifada.                             |

Además informa:

- **Dónde declaró el conductor** (por ejemplo, _Avenida Santa Fe 751 · mano impar · lugar 7_) y si coincide con la cuadra del agente, es una vecina u otra. La tarifa es por zona, así que estar en otra cuadra de la misma zona no es infracción, pero el agente lo ve.
- **Si la patente ya se controló** en las últimas 3 horas, para no labrar dos actas por lo mismo.

**Reglas del control:**

- Un vehículo vencido **sigue figurando como vencido** aunque el sistema ya haya cerrado su estacionamiento: el agente ve desde qué hora está sin cobertura.
- **En las esquinas** se consideran todas las cuadras a 40 metros del agente: si el vehículo pagó en la zona de una de ellas, está habilitado. Así no se marca `otra_zona` a quien estacionó en el límite entre dos zonas.
- Si el GPS no responde, el agente puede elegir la cuadra en el mapa. El control queda registrado sin precisión de GPS, para que se sepa que la ubicación no salió del dispositivo.

**Cada verificación queda registrada** con agente, patente, cuadra, ubicación, precisión del GPS, hora y resultado. Es la base para el labrado de actas (próxima versión) y para auditar la tarea de control.

## Próximas versiones

- Carga de saldo con Mercado Pago (hoy: cargas de prueba en entornos de desarrollo).
- Actas de infracción con foto y envío al Juzgado de Faltas.
- Exenciones (discapacidad, frentistas, vehículos oficiales) y abonos.
- Puntos de venta en comercios.
- Gestión de zonas, cuadras y tarifas desde el panel municipal (eligiendo manzanas en el mapa).
