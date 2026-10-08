import {
  ErrorDeDominio,
  MINUTOS_DE_VENCIDOS_RECIENTES,
  MINUTOS_POR_VENCER,
  alturaEnCuadra,
  estaEnHorarioDeCobro,
  liquidarEstacionamiento,
  normalizarPatente,
  situacion,
  vencimientoAlIniciar,
  type Lado,
  type Patente,
  type ReglaTarifaria,
} from '@parkia/domain';
import { and, eq, gte, inArray, like, or, sql } from 'drizzle-orm';

import { BilleteraService } from '../billetera/billetera.service.js';
import { ErrorDeApi } from '../comun/errores.js';
import { Reloj } from '../comun/reloj.js';
import { admiteCargasDePrueba, type Entorno } from '../config/entorno.js';
import type { Conexion } from '../db/conexion.js';
import {
  billeteras,
  controles,
  cuadras,
  estacionamientos,
  sesiones,
  usuarios,
  vehiculos,
  zonas,
} from '../db/esquema.js';
import { EstacionamientosService } from '../estacionamientos/estacionamientos.service.js';
import { MunicipiosService, type Municipio } from '../municipios/municipios.service.js';
import { ZonasService, type CuadraTarifada } from '../zonas/zonas.service.js';

/**
 * Dominio de las cuentas ficticias. Es un subdominio propio de Parkia: ninguna
 * cuenta real puede tenerlo, y es lo único que identifica lo simulado.
 */
export const DOMINIO_SIMULADO = 'demo.parkia.net.ar';

const MS_POR_MINUTO = 60_000;
const esSimulado = like(usuarios.email, `%@${DOMINIO_SIMULADO}`);

export interface OpcionesDeSimulacion {
  /** Slug del municipio. */
  readonly municipio: string;
  /** Fracción de la capacidad de las cuadras que se busca ocupar (0 a 0,9). */
  readonly ocupacion: number;
  /**
   * Retroactiva: arma de una vez una foto creíble, con inicios en el pasado,
   * vencidos recientes y estacionamientos por vencer. Si no, los conductores
   * llegan ahora y los vencidos aparecen solos, a medida que pasa el tiempo.
   */
  readonly retroactiva: boolean;
  /** Misma semilla, mismas decisiones (útil para reproducir una corrida). */
  readonly semilla?: number | undefined;
}

export interface ResumenDeSimulacion {
  readonly municipio: string;
  readonly capacidad: number;
  readonly conductores: number;
  /** Estacionamientos iniciados en esta pasada (incluye los que se cerraron vencidos). */
  readonly iniciados: number;
  /** Finalizados por el conductor al cumplir su estadía. */
  readonly retirados: number;
  /** Cerrados por saldo agotado en esta pasada. */
  readonly cerradosPorSaldo: number;
  /** Llegadas que no se pudieron concretar (sin lugar, patente ocupada, fuera de horario…). */
  readonly omitidos: number;
  /** Situación de lo simulado al terminar. */
  readonly enCurso: number;
  readonly porVencer: number;
  readonly vencidosRecientes: number;
}

export interface ResumenDeLimpieza {
  readonly conductores: number;
  readonly estacionamientos: number;
  readonly controles: number;
  readonly vehiculos: number;
}

/** La simulación crea saldo sin pago real: nunca corre en producción. */
export class SimulacionNoPermitida extends Error {
  constructor() {
    super('La simulación de actividad solo corre con PARKIA_ENTORNO=demo o desarrollo.');
    this.name = 'SimulacionNoPermitida';
  }
}

type Categoria = 'vigente' | 'por_vencer' | 'vencido';

interface Conductor {
  readonly usuarioId: string;
  readonly patente: Patente;
}

interface Mano {
  readonly cuadra: CuadraTarifada;
  readonly lado: Lado;
  readonly capacidad: number;
  /** Preferencia estable de la mano: unas cuadras se llenan más que otras. */
  readonly atractivo: number;
}

interface Plan {
  readonly inicio: Date;
  /** Saldo con el que se inicia: define el vencimiento según la regla de la zona. */
  readonly saldo: number;
}

/** Reloj que la simulación mueve al pasado para iniciar estacionamientos retroactivos. */
class RelojDeSimulacion extends Reloj {
  private actual = new Date();

  ahora(): Date {
    return new Date(this.actual);
  }

  fijar(instante: Date): void {
    this.actual = new Date(instante);
  }
}

/** Generador pseudoaleatorio con semilla (mulberry32). */
function generador(semilla: number): () => number {
  let estado = semilla >>> 0;
  return () => {
    estado = (estado + 0x6d2b79f5) >>> 0;
    let t = estado;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

/** Hash estable (FNV-1a) en [0, 1): decisiones que se recalculan igual en cada pasada. */
function fraccionEstable(texto: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash / 4_294_967_296;
}

/**
 * Patentes de los conductores ficticios, siempre las mismas para el mismo
 * índice: siete de cada diez con formato Mercosur, el resto del formato anterior.
 */
function patentesSimuladas(cantidad: number): Patente[] {
  const azar = generador(0x7061726b);
  const letra = (desde = 0, opciones = 26) =>
    String.fromCharCode(65 + desde + Math.floor(azar() * opciones));
  const digitos = () => String(Math.floor(azar() * 1000)).padStart(3, '0');
  const patentes = new Set<string>();
  while (patentes.size < cantidad) {
    patentes.add(
      azar() < 0.7
        ? `A${letra(0, 8)}${digitos()}${letra()}${letra()}`
        : `${letra(6, 10)}${letra()}${letra()}${digitos()}`,
    );
  }
  return [...patentes].map(normalizarPatente);
}

/** Cuánto se queda estacionado el conductor: entre 30 minutos y 3 horas. */
function estadiaPlanificada(patente: string, inicio: Date): number {
  return 30 + Math.floor(fraccionEstable(`${patente}|${inicio.toISOString()}`) * 150);
}

const sumarMinutos = (instante: Date, minutos: number) =>
  new Date(instante.getTime() + minutos * MS_POR_MINUTO);

/**
 * Inicio y saldo con los que, según la regla real de la zona, un
 * estacionamiento vence cerca de `objetivo`. Con el saldo fijo, desplaza el
 * inicio hasta que el vencimiento caiga en la ventana; `null` si no se logra
 * (por ejemplo, porque en ese momento no se cobraba).
 */
function planHacia(
  regla: ReglaTarifaria,
  objetivo: Date,
  duracionMinutos: number,
  enVentana: (venceEn: Date) => boolean,
): Plan | null {
  let inicio = sumarMinutos(objetivo, -duracionMinutos);
  const saldo = liquidarEstacionamiento(regla, { inicio, fin: objetivo }).importe;
  if (saldo === 0) return null;
  for (let intento = 0; intento < 4; intento++) {
    let venceEn: Date | null;
    try {
      venceEn = vencimientoAlIniciar(regla, inicio, saldo);
    } catch (error) {
      if (error instanceof ErrorDeDominio) return null;
      throw error;
    }
    if (venceEn === null) return null;
    if (enVentana(venceEn)) return { inicio, saldo };
    inicio = new Date(inicio.getTime() + objetivo.getTime() - venceEn.getTime());
  }
  return null;
}

/**
 * Genera actividad de conductores ficticios para mostrar el sistema: padrones
 * con vehículos, radar con vencidos y por vencer, y ocupación en el mapa.
 *
 * No escribe en la base por su cuenta: estaciona, carga saldo y finaliza con
 * los mismos servicios que la API, así que vencimientos e importes salen de la
 * regla tarifaria real de cada zona. Solo modifica cuentas de `DOMINIO_SIMULADO`.
 */
export class Simulador {
  private readonly reloj = new RelojDeSimulacion();
  private readonly municipios: MunicipiosService;
  private readonly zonas: ZonasService;
  private readonly billetera: BilleteraService;
  private readonly estacionamientos: EstacionamientosService;

  constructor(
    private readonly conexion: Conexion,
    entorno: Pick<Entorno, 'PARKIA_ENTORNO'>,
    private readonly ahora: () => Date = () => new Date(),
  ) {
    if (!admiteCargasDePrueba(entorno)) throw new SimulacionNoPermitida();
    this.municipios = new MunicipiosService(conexion);
    this.zonas = new ZonasService(conexion, this.municipios, this.reloj);
    this.billetera = new BilleteraService(conexion, this.municipios, this.reloj);
    this.estacionamientos = new EstacionamientosService(
      conexion,
      this.municipios,
      this.zonas,
      this.billetera,
      this.reloj,
    );
  }

  /** Si alguna zona del municipio está cobrando en este momento. */
  async enHorarioDeCobro(slugMunicipio: string): Promise<boolean> {
    const ahora = this.ahora();
    const municipio = await this.municipios.porSlug(slugMunicipio);
    const manos = await this.manosTarifadas(municipio);
    return manos.some((mano) => estaEnHorarioDeCobro(mano.cuadra.zona.regla, ahora));
  }

  /**
   * Una pasada de la simulación. Converge a la ocupación pedida: repetirla no
   * duplica nada, solo hace avanzar el tiempo (cierra vencidos, retira a quien
   * cumplió su estadía y repone llegadas).
   */
  async ejecutar(opciones: OpcionesDeSimulacion): Promise<ResumenDeSimulacion> {
    if (!(opciones.ocupacion >= 0 && opciones.ocupacion <= 0.9)) {
      throw new RangeError('La ocupación debe estar entre 0 y 0,9.');
    }
    const ahora = this.ahora();
    const azar = generador(opciones.semilla ?? Math.floor(Math.random() * 2 ** 32));
    const entre = (minimo: number, maximo: number) => minimo + azar() * (maximo - minimo);

    const municipio = await this.municipios.porSlug(opciones.municipio);
    const manos = await this.manosTarifadas(municipio);
    const capacidad = manos.reduce((total, mano) => total + mano.capacidad, 0);
    const objetivo = Math.round(capacidad * opciones.ocupacion);
    // Sobran conductores: los que vencieron hace poco siguen ocupando su lugar.
    const conductores = await this.asegurarConductores(Math.ceil(objetivo * 1.25) + 10);

    // 1. Lo simulado que venció se cierra y quien cumplió su estadía se va.
    let cerradosPorSaldo = 0;
    let retirados = 0;
    for (const fila of await this.simuladosEnCurso(municipio)) {
      this.reloj.fijar(ahora);
      const vencido = fila.venceEn <= ahora;
      const salida = sumarMinutos(fila.inicio, estadiaPlanificada(fila.patente, fila.inicio));
      if (!vencido && salida > ahora) continue;
      await this.estacionamientos.finalizar(fila.usuarioId, municipio.slug, fila.id);
      if (vencido) cerradosPorSaldo++;
      else retirados++;
    }

    // 2. Llegadas hasta alcanzar la ocupación pedida.
    const estado = await this.estado(municipio, ahora);
    const objetivoVencidos = opciones.retroactiva ? Math.max(3, Math.round(objetivo * 0.06)) : 0;
    const objetivoPorVencer = opciones.retroactiva ? Math.max(3, Math.round(objetivo * 0.05)) : 0;
    const porVencer = Math.max(0, objetivoPorVencer - estado.simulados.porVencer);
    const llegadas: Categoria[] = [
      ...Array<Categoria>(Math.max(0, objetivoVencidos - estado.simulados.vencidos)).fill(
        'vencido',
      ),
      ...Array<Categoria>(porVencer).fill('por_vencer'),
      ...Array<Categoria>(Math.max(0, objetivo - estado.activos - porVencer)).fill('vigente'),
    ];

    const saldos = await this.saldos(municipio);
    const saldoDe = (conductor: Conductor) => saldos.get(conductor.usuarioId) ?? 0;
    const libres = conductores
      .filter((c) => !estado.ocupados.has(c.usuarioId))
      .sort((a, b) => saldoDe(a) - saldoDe(b));
    let iniciados = 0;
    let omitidos = 0;

    for (const categoria of llegadas) {
      const mano = this.elegirMano(manos, estado.porMano, azar);
      // Para vencer en un momento preciso, el saldo previo no puede pasarse del
      // necesario: se usa al conductor con menos saldo.
      const indice = categoria === 'vigente' ? Math.floor(azar() * libres.length) : 0;
      const conductor = libres[indice];
      if (!mano || !conductor) {
        omitidos++;
        continue;
      }

      // Quien sigue estacionado tiene que irse en el futuro: si no, la próxima
      // pasada lo retiraría sin que haya pasado el tiempo.
      const sigueEstacionado = (plan: Plan) =>
        categoria === 'vencido' ||
        sumarMinutos(plan.inicio, estadiaPlanificada(conductor.patente, plan.inicio)) > ahora;
      let plan: Plan | null = null;
      for (let intento = 0; intento < 10 && !plan; intento++) {
        const candidato = this.planificar(
          categoria,
          mano.cuadra.zona.regla,
          ahora,
          conductor,
          opciones.retroactiva,
          entre,
        );
        if (candidato && sigueEstacionado(candidato)) plan = candidato;
      }
      const saldoPrevio = saldoDe(conductor);
      if (!plan || (categoria !== 'vigente' && saldoPrevio > plan.saldo)) {
        omitidos++;
        continue;
      }

      const ocupados = estado.lugares.get(clave(mano)) ?? new Set<number>();
      const lugar = mano.cuadra.lugaresNumerados
        ? this.lugarLibre(mano.capacidad, ocupados, azar)
        : undefined;
      libres.splice(indice, 1);

      try {
        this.reloj.fijar(plan.inicio);
        if (plan.saldo > saldoPrevio) {
          await this.billetera.cargaDePrueba(
            conductor.usuarioId,
            municipio.slug,
            plan.saldo - saldoPrevio,
          );
        }
        const iniciado = await this.estacionamientos.iniciar(conductor.usuarioId, municipio.slug, {
          cuadraId: mano.cuadra.id,
          lado: mano.lado,
          altura: alturaEnCuadra(mano.cuadra, entre(0.05, 0.95), mano.lado),
          lugar,
          patente: conductor.patente,
        });
        iniciados++;
        if (categoria === 'vencido') {
          this.reloj.fijar(ahora);
          await this.estacionamientos.finalizar(conductor.usuarioId, municipio.slug, iniciado.id);
          cerradosPorSaldo++;
        }
      } catch (error) {
        // Una patente ficticia puede coincidir con una real en curso: se sigue con otra.
        if (!(error instanceof ErrorDeApi || error instanceof ErrorDeDominio)) throw error;
        omitidos++;
        continue;
      }

      estado.porMano.set(clave(mano), (estado.porMano.get(clave(mano)) ?? 0) + 1);
      if (lugar !== undefined) estado.lugares.set(clave(mano), ocupados.add(lugar));
    }

    const final = await this.estado(municipio, ahora);
    return {
      municipio: municipio.slug,
      capacidad,
      conductores: conductores.length,
      iniciados,
      retirados,
      cerradosPorSaldo,
      omitidos,
      enCurso: final.simulados.enCurso,
      porVencer: final.simulados.porVencer,
      vencidosRecientes: final.simulados.vencidos,
    };
  }

  /**
   * Borra la actividad simulada: estacionamientos, los controles hechos sobre
   * ellos, vehículos y sesiones, y desactiva las cuentas. Las billeteras y sus
   * movimientos quedan: el libro de movimientos es inmutable por diseño.
   */
  async limpiar(): Promise<ResumenDeLimpieza> {
    return this.conexion.db.transaction(async (tx) => {
      const simulados = tx.select({ id: usuarios.id }).from(usuarios).where(esSimulado);
      const suyos = tx
        .select({ id: estacionamientos.id })
        .from(estacionamientos)
        .where(inArray(estacionamientos.usuarioId, simulados));

      const borradosControles = await tx
        .delete(controles)
        .where(inArray(controles.estacionamientoId, suyos))
        .returning({ id: controles.id });
      const borradosEstacionamientos = await tx
        .delete(estacionamientos)
        .where(inArray(estacionamientos.usuarioId, simulados))
        .returning({ id: estacionamientos.id });
      const borradosVehiculos = await tx
        .delete(vehiculos)
        .where(inArray(vehiculos.usuarioId, simulados))
        .returning({ id: vehiculos.id });
      await tx.delete(sesiones).where(inArray(sesiones.usuarioId, simulados));
      const desactivados = await tx
        .update(usuarios)
        .set({ activo: false })
        .where(esSimulado)
        .returning({ id: usuarios.id });

      return {
        conductores: desactivados.length,
        estacionamientos: borradosEstacionamientos.length,
        controles: borradosControles.length,
        vehiculos: borradosVehiculos.length,
      };
    });
  }

  /** Inicio y saldo de una llegada, según la regla de la zona y lo que se busca mostrar. */
  private planificar(
    categoria: Categoria,
    regla: ReglaTarifaria,
    ahora: Date,
    conductor: Conductor,
    retroactiva: boolean,
    entre: (minimo: number, maximo: number) => number,
  ): Plan | null {
    const duracion = Math.round(entre(45, 150));
    switch (categoria) {
      case 'vencido': {
        const limite = sumarMinutos(ahora, -(MINUTOS_DE_VENCIDOS_RECIENTES - 15));
        return planHacia(
          regla,
          sumarMinutos(ahora, -Math.round(entre(5, 90))),
          duracion,
          (venceEn) => venceEn >= limite && venceEn <= sumarMinutos(ahora, -1),
        );
      }
      case 'por_vencer':
        return planHacia(
          regla,
          sumarMinutos(ahora, Math.round(entre(3, MINUTOS_POR_VENCER - 2))),
          duracion,
          (venceEn) => situacion(venceEn, ahora) === 'por_vencer',
        );
      case 'vigente': {
        const costo = (inicio: Date, fin: Date) =>
          liquidarEstacionamiento(regla, { inicio, fin }).importe;
        if (retroactiva) {
          const inicio = sumarMinutos(ahora, -Math.round(entre(5, 100)));
          const venceEn = sumarMinutos(ahora, Math.round(entre(MINUTOS_POR_VENCER + 10, 150)));
          return { inicio, saldo: costo(inicio, venceEn) };
        }
        // Llega ahora. Uno de cada cinco paga menos de lo que se queda: vencerá estacionado.
        const estadia = estadiaPlanificada(conductor.patente, ahora);
        const cobertura =
          entre(0, 1) < 0.2
            ? Math.max(35, Math.round(estadia * entre(0.4, 0.8)))
            : estadia + Math.round(entre(10, 45));
        return { inicio: ahora, saldo: costo(ahora, sumarMinutos(ahora, cobertura)) };
      }
    }
  }

  /** Una mano con lugar libre, al azar y ponderada por su atractivo. */
  private elegirMano(
    manos: readonly Mano[],
    porMano: ReadonlyMap<string, number>,
    azar: () => number,
  ): Mano | undefined {
    const pesos = manos.map(
      (mano) => Math.max(0, mano.capacidad - (porMano.get(clave(mano)) ?? 0)) * mano.atractivo,
    );
    const total = pesos.reduce((suma, peso) => suma + peso, 0);
    if (total === 0) return undefined;
    let restante = azar() * total;
    for (const [i, mano] of manos.entries()) {
      restante -= pesos[i] ?? 0;
      if (restante < 0) return mano;
    }
    return manos.findLast((_, i) => (pesos[i] ?? 0) > 0);
  }

  private lugarLibre(capacidad: number, ocupados: ReadonlySet<number>, azar: () => number) {
    const libres = Array.from({ length: capacidad }, (_, i) => i + 1).filter(
      (lugar) => !ocupados.has(lugar),
    );
    return libres[Math.floor(azar() * libres.length)];
  }

  private async manosTarifadas(municipio: Municipio): Promise<Mano[]> {
    const filas = await this.conexion.db
      .select({ id: cuadras.id })
      .from(cuadras)
      .innerJoin(zonas, eq(zonas.id, cuadras.zonaId))
      .where(
        and(
          eq(cuadras.municipioId, municipio.id),
          eq(cuadras.activa, true),
          eq(zonas.activa, true),
        ),
      )
      .orderBy(cuadras.calle, cuadras.alturaDesde);
    const manos: Mano[] = [];
    for (const { id } of filas) {
      const cuadra = await this.zonas.cuadraPorId(municipio, id);
      for (const lado of ['par', 'impar'] as const) {
        if (cuadra.lugares[lado] === 0) continue;
        manos.push({
          cuadra,
          lado,
          capacidad: cuadra.lugares[lado],
          atractivo: 0.15 + 0.85 * fraccionEstable(`${cuadra.id}:${lado}`),
        });
      }
    }
    return manos;
  }

  /** Crea (o reactiva) los conductores ficticios con su vehículo. Idempotente. */
  private async asegurarConductores(cantidad: number): Promise<Conductor[]> {
    const patentes = patentesSimuladas(cantidad);
    const cuentas = patentes.map((_, i) => {
      const numero = String(i + 1).padStart(3, '0');
      return {
        email: `conductor-${numero}@${DOMINIO_SIMULADO}`,
        nombre: `Conductor simulado ${numero}`,
      };
    });
    const filas = await this.conexion.db
      .insert(usuarios)
      .values(cuentas)
      .onConflictDoUpdate({ target: usuarios.email, set: { activo: true } })
      .returning({ id: usuarios.id, email: usuarios.email });
    const ids = new Map(filas.map((fila) => [fila.email, fila.id]));
    const conductores = cuentas.map(({ email }, i): Conductor => {
      const usuarioId = ids.get(email);
      const patente = patentes[i];
      if (!usuarioId || !patente) throw new Error(`No se pudo crear ${email}.`);
      return { usuarioId, patente };
    });
    await this.conexion.db
      .insert(vehiculos)
      .values(conductores.map((c) => ({ usuarioId: c.usuarioId, patente: c.patente })))
      .onConflictDoNothing();
    return conductores;
  }

  private async simuladosEnCurso(municipio: Municipio) {
    return this.conexion.db
      .select({
        id: estacionamientos.id,
        usuarioId: estacionamientos.usuarioId,
        patente: estacionamientos.patente,
        inicio: estacionamientos.inicio,
        venceEn: estacionamientos.venceEn,
      })
      .from(estacionamientos)
      .innerJoin(usuarios, eq(usuarios.id, estacionamientos.usuarioId))
      .where(
        and(
          eq(estacionamientos.municipioId, municipio.id),
          eq(estacionamientos.estado, 'activo'),
          esSimulado,
        ),
      );
  }

  private async saldos(municipio: Municipio): Promise<Map<string, number>> {
    const filas = await this.conexion.db
      .select({ usuarioId: billeteras.usuarioId, saldo: billeteras.saldo })
      .from(billeteras)
      .innerJoin(usuarios, eq(usuarios.id, billeteras.usuarioId))
      .where(and(eq(billeteras.municipioId, municipio.id), esSimulado));
    return new Map(filas.map((fila) => [fila.usuarioId, fila.saldo]));
  }

  /**
   * Ocupación actual del municipio (real y simulada). Un vencido reciente sigue
   * contando: probablemente el vehículo todavía esté en su lugar.
   */
  private async estado(municipio: Municipio, ahora: Date) {
    const filas = await this.conexion.db
      .select({
        usuarioId: estacionamientos.usuarioId,
        cuadraId: estacionamientos.cuadraId,
        lado: estacionamientos.lado,
        lugar: estacionamientos.lugar,
        venceEn: estacionamientos.venceEn,
        activo: sql<boolean>`${estacionamientos.estado} = 'activo'`,
        simulado: sql<boolean>`${esSimulado}`,
      })
      .from(estacionamientos)
      .innerJoin(usuarios, eq(usuarios.id, estacionamientos.usuarioId))
      .where(
        and(
          eq(estacionamientos.municipioId, municipio.id),
          or(
            eq(estacionamientos.estado, 'activo'),
            and(
              eq(estacionamientos.motivoDeCierre, 'saldo_agotado'),
              gte(estacionamientos.fin, sumarMinutos(ahora, -MINUTOS_DE_VENCIDOS_RECIENTES)),
            ),
          ),
        ),
      );

    const porMano = new Map<string, number>();
    const lugares = new Map<string, Set<number>>();
    const ocupados = new Set<string>();
    const simulados = { enCurso: 0, porVencer: 0, vencidos: 0 };
    for (const fila of filas) {
      if (fila.cuadraId && fila.lado) {
        const mano = `${fila.cuadraId}:${fila.lado}`;
        porMano.set(mano, (porMano.get(mano) ?? 0) + 1);
        if (fila.lugar !== null)
          lugares.set(mano, (lugares.get(mano) ?? new Set()).add(fila.lugar));
      }
      if (!fila.simulado) continue;
      ocupados.add(fila.usuarioId);
      if (!fila.activo) simulados.vencidos++;
      else {
        simulados.enCurso++;
        if (situacion(fila.venceEn, ahora) === 'por_vencer') simulados.porVencer++;
      }
    }
    return {
      activos: filas.filter((fila) => fila.activo).length,
      porMano,
      lugares,
      ocupados,
      simulados,
    };
  }
}

const clave = (mano: Pick<Mano, 'cuadra' | 'lado'>) => `${mano.cuadra.id}:${mano.lado}`;
