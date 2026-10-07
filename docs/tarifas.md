# Parkia — Cómo se calcula una tarifa

Este documento describe, en lenguaje llano, las reglas que aplica Parkia para calcular cuánto cuesta un estacionamiento. Está pensado para funcionarios municipales, concejales y para redactar la ordenanza. La implementación vive en `packages/domain` y cada regla tiene tests automáticos.

## Parámetros configurables por zona

| Parámetro                      | Ejemplo                                                     | Qué significa                                                                           |
| ------------------------------ | ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **Horario de cobro**           | Lun–Vie 08:00–20:00, Sáb 08:00–13:00                        | Solo se cobra el tiempo dentro de estas franjas. Admite horario partido (08–13 y 16–20) |
| **Días especiales**            | Feriado 12/10: sin cobro                                    | Reemplazan el horario habitual de ese día. Sin franjas = no se cobra                    |
| **Fracción**                   | 15 minutos                                                  | Unidad de cobro: el tiempo se redondea hacia arriba a la fracción                       |
| **Mínimo**                     | 30 minutos                                                  | Tiempo mínimo facturado una vez superada la tolerancia                                  |
| **Tolerancia**                 | 5 minutos                                                   | Si el tiempo no la supera, no se cobra                                                  |
| **Tramos (tarifa progresiva)** | 1.ª hora $1.000/h, 2.ª hora $1.500/h, desde la 3.ª $1.650/h | Desalienta la permanencia prolongada y favorece la rotación                             |
| **Tope por jornada**           | $10.000                                                     | Monto máximo a cobrar en un mismo día                                                   |

## Reglas de cálculo

1. **Solo cuenta el tiempo dentro del horario de cobro.** Si alguien estaciona de 19:30 a 21:00 y el cobro termina a las 20:00, se cobran 30 minutos.
2. **Un minuto empezado cuenta como minuto completo.** 30 minutos y 1 segundo son 31 minutos.
3. **Cada jornada se liquida por separado.** Un vehículo que queda del viernes al sábado paga la parte del viernes y la del sábado como dos jornadas independientes: la tolerancia, el mínimo, los tramos y el tope se aplican en cada una.
4. **Tolerancia:** si los minutos cobrables de la jornada no superan la tolerancia, el importe es $0.
5. **Redondeo y mínimo:** superada la tolerancia, el tiempo se redondea hacia arriba a la fracción y nunca se factura menos que el mínimo.
6. **Tramos:** cada fracción se cobra al precio del tramo en el que comienza. Con fracciones de 15 minutos y $1.000/h, cada fracción de la primera hora cuesta $250.
7. **Tope:** si el importe de la jornada supera el tope, se cobra el tope.
8. **Redondeo de dinero:** el precio de cada fracción se redondea al centavo. Todo el cálculo se hace en centavos enteros, sin errores de redondeo acumulados.
9. **Zona horaria:** los horarios se interpretan en la hora local del municipio.

## Ejemplos (con los valores de la tabla)

| Estacionamiento              | Minutos cobrables | Facturado         | Importe        |
| ---------------------------- | ----------------- | ----------------- | -------------- |
| Lunes 10:00–10:05            | 5                 | — (tolerancia)    | $0             |
| Lunes 10:00–10:06            | 6                 | 30 min (mínimo)   | $500           |
| Lunes 10:00–10:31            | 31                | 45 min            | $750           |
| Lunes 10:00–11:01            | 61                | 75 min            | $1.375         |
| Lunes 10:00–13:00            | 180               | 180 min           | $4.150         |
| Lunes 19:30–21:00            | 30                | 30 min            | $500           |
| Lunes 08:00–20:00            | 720               | 720 min ($19.000) | $10.000 (tope) |
| Viernes 19:00 – Sábado 09:00 | 60 + 60           | dos jornadas      | $2.000         |
| Domingo o feriado            | 0                 | —                 | $0             |

## Vencimiento del saldo

Con saldo prepago, Parkia calcula **hasta qué hora alcanza el saldo** para un estacionamiento en curso (salteando el tiempo fuera del horario de cobro). Con eso avisa al conductor antes de que se agote. Ejemplo: con $500 de saldo, un estacionamiento iniciado el lunes a las 10:00 está cubierto hasta las 10:30.

## Límites

- Un horario que cruza la medianoche se carga como dos franjas (por ejemplo, 20:00–24:00 y 00:00–02:00 del día siguiente).
- Ningún estacionamiento se liquida por más de 31 días.
