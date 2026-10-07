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

## Estacionar

1. El conductor elige la zona (o la app la detecta por GPS) y la patente.
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

El agente ingresa (o escanea) la patente. Parkia usa su ubicación GPS para saber en qué zona está y responde:

| Resultado             | ¿Habilitado? | Significado                                                  |
| --------------------- | ------------ | ------------------------------------------------------------ |
| `habilitado`          | ✅ Sí        | Tiene un estacionamiento vigente en esta zona.               |
| `fuera_de_horario`    | ✅ Sí        | En este momento no se cobra en la zona.                      |
| `sin_estacionamiento` | ❌ No        | No tiene un estacionamiento en curso.                        |
| `vencido`             | ❌ No        | Tenía un estacionamiento, pero se agotó el saldo.            |
| `otra_zona`           | ❌ No        | Pagó en otra zona tarifada.                                  |
| `fuera_de_zona`       | —            | La ubicación del agente no está dentro de una zona tarifada. |

**Cada verificación queda registrada** con agente, patente, ubicación, hora y resultado. Es la base para el labrado de actas (próxima versión) y para auditar la tarea de control.

## Próximas versiones

- Carga de saldo con Mercado Pago (hoy: cargas de prueba en entornos de desarrollo).
- Actas de infracción con foto y envío al Juzgado de Faltas.
- Exenciones (discapacidad, frentistas, vehículos oficiales) y abonos.
- Puntos de venta en comercios.
- Gestión de zonas y tarifas desde el panel municipal.
