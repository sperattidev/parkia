import { Body, Controller, Get, Param, Patch, Post, Query, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  altaDePersonaSchema,
  cambioDeCuadraSchema,
  cambioDePersonaSchema,
  cambioDeZonaSchema,
  credencialTemporalSchema,
  cuadrasDeGestionSchema,
  entradaDeAuditoriaSchema,
  filaDeControlSchema,
  filaDeEstacionamientoSchema,
  filtroDeControlesSchema,
  filtroDeEstacionamientosSchema,
  listaPaginadaSchema,
  paginaSchema,
  periodoSchema,
  personaSchema,
  resumenDeGestionSchema,
  slugMunicipioSchema,
  zonaDeGestionSchema,
  zonaNuevaSchema,
  type CredencialTemporal,
  type CuadrasDeGestion,
  type EntradaDeAuditoria,
  type FilaDeControl,
  type FilaDeEstacionamiento,
  type ListaPaginada,
  type Persona,
  type ResumenDeGestion,
  type ZonaDeGestion,
} from '@parkia/contracts';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { RequiereRol, UsuarioActual } from '../autenticacion/decoradores.js';
import type { UsuarioAutenticado } from '../autenticacion/tipos.js';
import { ConfiguracionService } from './configuracion.service.js';
import { ListadosService } from './listados.service.js';
import { PersonalService } from './personal.service.js';
import { ResumenService } from './resumen.service.js';

const municipioParam = { schema: slugMunicipioSchema };
const uuidParam = { schema: z.uuid() };

function comoCsv(respuesta: FastifyReply, nombre: string, contenido: string): string {
  void respuesta
    .header('content-type', 'text/csv; charset=utf-8')
    .header('content-disposition', `attachment; filename="${nombre}.csv"`)
    .header('cache-control', 'no-store');
  return contenido;
}

/** Panel municipal: requiere rol de administrador en el municipio (o ser del equipo de Parkia). */
@ApiTags('Gestión municipal')
@ApiBearerAuth()
@RequiereRol('admin')
@Controller('municipios/:municipio/gestion')
export class GestionController {
  constructor(
    private readonly resumenes: ResumenService,
    private readonly listados: ListadosService,
    private readonly configuracion: ConfiguracionService,
    private readonly personal: PersonalService,
  ) {}

  @Get('resumen')
  @ApiOperation({ summary: 'Recaudación, uso, ocupación y controles del período' })
  @ApiResponse({ status: 200, standardSchema: resumenDeGestionSchema })
  resumen(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: periodoSchema }) periodo: z.infer<typeof periodoSchema>,
  ): Promise<ResumenDeGestion> {
    return this.resumenes.resumen(municipio, periodo);
  }

  // ─── Estacionamientos y controles ──────────────────────────────────────────

  @Get('estacionamientos')
  @ApiOperation({ summary: 'Estacionamientos del período, los más recientes primero' })
  @ApiResponse({ status: 200, standardSchema: listaPaginadaSchema(filaDeEstacionamientoSchema) })
  estacionamientos(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: filtroDeEstacionamientosSchema.extend(paginaSchema.shape) })
    {
      pagina,
      porPagina,
      ...filtro
    }: z.infer<typeof filtroDeEstacionamientosSchema> & z.infer<typeof paginaSchema>,
  ): Promise<ListaPaginada<FilaDeEstacionamiento>> {
    return this.listados.estacionamientos(municipio, filtro, { pagina, porPagina });
  }

  @Get('exportaciones/estacionamientos')
  @ApiOperation({ summary: 'Estacionamientos del período en CSV (Excel)' })
  @ApiProduces('text/csv')
  async exportarEstacionamientos(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: filtroDeEstacionamientosSchema })
    filtro: z.infer<typeof filtroDeEstacionamientosSchema>,
    @Res({ passthrough: true }) respuesta: FastifyReply,
  ): Promise<string> {
    const csv = await this.listados.exportarEstacionamientos(municipio, filtro);
    return comoCsv(respuesta, `estacionamientos-${municipio}`, csv);
  }

  @Get('controles')
  @ApiOperation({ summary: 'Controles del período, los más recientes primero' })
  @ApiResponse({ status: 200, standardSchema: listaPaginadaSchema(filaDeControlSchema) })
  controles(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: filtroDeControlesSchema.extend(paginaSchema.shape) })
    {
      pagina,
      porPagina,
      ...filtro
    }: z.infer<typeof filtroDeControlesSchema> & z.infer<typeof paginaSchema>,
  ): Promise<ListaPaginada<FilaDeControl>> {
    return this.listados.controles(municipio, filtro, { pagina, porPagina });
  }

  @Get('exportaciones/controles')
  @ApiOperation({ summary: 'Controles del período en CSV (Excel)' })
  @ApiProduces('text/csv')
  async exportarControles(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: filtroDeControlesSchema }) filtro: z.infer<typeof filtroDeControlesSchema>,
    @Res({ passthrough: true }) respuesta: FastifyReply,
  ): Promise<string> {
    const csv = await this.listados.exportarControles(municipio, filtro);
    return comoCsv(respuesta, `controles-${municipio}`, csv);
  }

  // ─── Zonas, tarifas y cuadras ──────────────────────────────────────────────

  @Get('zonas')
  @ApiOperation({ summary: 'Zonas con su tarifa, cantidad de cuadras y capacidad' })
  @ApiResponse({ status: 200, standardSchema: z.array(zonaDeGestionSchema) })
  zonas(@Param('municipio', municipioParam) municipio: string): Promise<ZonaDeGestion[]> {
    return this.configuracion.zonas(municipio);
  }

  @Post('zonas')
  @ApiOperation({ summary: 'Crea una zona tarifada' })
  @ApiResponse({ status: 201, standardSchema: zonaDeGestionSchema })
  @ApiResponse({ status: 409, description: 'ZONA_EXISTENTE' })
  crearZona(
    @Param('municipio', municipioParam) municipio: string,
    @Body({ schema: zonaNuevaSchema }) zona: z.input<typeof zonaNuevaSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ZonaDeGestion> {
    return this.configuracion.crearZona(usuario.id, municipio, zona);
  }

  @Patch('zonas/:zona')
  @ApiOperation({
    summary: 'Cambia nombre, color, estado o tarifa de una zona',
    description: 'Los estacionamientos en curso conservan la tarifa con la que empezaron.',
  })
  @ApiResponse({ status: 200, standardSchema: zonaDeGestionSchema })
  cambiarZona(
    @Param('municipio', municipioParam) municipio: string,
    @Param('zona', uuidParam) zona: string,
    @Body({ schema: cambioDeZonaSchema }) cambio: z.input<typeof cambioDeZonaSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<ZonaDeGestion> {
    return this.configuracion.cambiarZona(usuario.id, municipio, zona, cambio);
  }

  @Get('cuadras')
  @ApiOperation({ summary: 'Todas las cuadras del municipio, con o sin zona' })
  @ApiResponse({ status: 200, standardSchema: cuadrasDeGestionSchema })
  cuadras(@Param('municipio', municipioParam) municipio: string): Promise<CuadrasDeGestion> {
    return this.configuracion.cuadras(municipio);
  }

  @Patch('cuadras/:cuadra')
  @ApiOperation({ summary: 'Asigna la cuadra a una zona, cambia su capacidad o la activa' })
  @ApiResponse({ status: 200, standardSchema: cuadrasDeGestionSchema })
  async cambiarCuadra(
    @Param('municipio', municipioParam) municipio: string,
    @Param('cuadra', uuidParam) cuadra: string,
    @Body({ schema: cambioDeCuadraSchema }) cambio: z.infer<typeof cambioDeCuadraSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<CuadrasDeGestion> {
    await this.configuracion.cambiarCuadra(usuario.id, municipio, cuadra, cambio);
    return this.configuracion.cuadras(municipio);
  }

  // ─── Personal ──────────────────────────────────────────────────────────────

  @Get('personal')
  @ApiOperation({ summary: 'Personal del municipio con su rol y actividad' })
  @ApiResponse({ status: 200, standardSchema: z.array(personaSchema) })
  listarPersonal(@Param('municipio', municipioParam) municipio: string): Promise<Persona[]> {
    return this.personal.listar(municipio);
  }

  @Post('personal')
  @ApiOperation({
    summary: 'Da de alta a una persona',
    description:
      'Devuelve una contraseña temporal (una sola vez) que la persona debe cambiar al ingresar.',
  })
  @ApiResponse({ status: 201, standardSchema: credencialTemporalSchema })
  @ApiResponse({ status: 409, description: 'EMAIL_DE_CONDUCTOR o PERSONAL_EXISTENTE' })
  altaDePersonal(
    @Param('municipio', municipioParam) municipio: string,
    @Body({ schema: altaDePersonaSchema }) datos: z.infer<typeof altaDePersonaSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<CredencialTemporal> {
    return this.personal.alta(usuario, municipio, datos);
  }

  @Patch('personal/:usuario')
  @ApiOperation({ summary: 'Cambia el rol o da de baja (y de alta) a una persona' })
  @ApiResponse({ status: 200, standardSchema: personaSchema })
  @ApiResponse({ status: 422, description: 'NO_PODES_QUITARTE_ACCESO o ULTIMO_ADMINISTRADOR' })
  cambiarPersonal(
    @Param('municipio', municipioParam) municipio: string,
    @Param('usuario', uuidParam) usuarioId: string,
    @Body({ schema: cambioDePersonaSchema }) cambio: z.infer<typeof cambioDePersonaSchema>,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<Persona> {
    return this.personal.cambiar(usuario, municipio, usuarioId, cambio);
  }

  @Post('personal/:usuario/restablecimientos')
  @ApiOperation({
    summary: 'Restablece la contraseña de una persona',
    description: 'Genera una contraseña temporal y cierra todas sus sesiones.',
  })
  @ApiResponse({ status: 201, standardSchema: credencialTemporalSchema })
  @ApiResponse({ status: 403, description: 'RESTABLECIMIENTO_NO_PERMITIDO' })
  restablecer(
    @Param('municipio', municipioParam) municipio: string,
    @Param('usuario', uuidParam) usuarioId: string,
    @UsuarioActual() usuario: UsuarioAutenticado,
  ): Promise<CredencialTemporal> {
    return this.personal.restablecer(usuario, municipio, usuarioId);
  }

  // ─── Auditoría ─────────────────────────────────────────────────────────────

  @Get('auditoria')
  @ApiOperation({ summary: 'Cambios de configuración: quién, qué y cuándo' })
  @ApiResponse({ status: 200, standardSchema: listaPaginadaSchema(entradaDeAuditoriaSchema) })
  auditoria(
    @Param('municipio', municipioParam) municipio: string,
    @Query({ schema: paginaSchema }) pagina: z.infer<typeof paginaSchema>,
  ): Promise<ListaPaginada<EntradaDeAuditoria>> {
    return this.listados.auditoria(municipio, pagina);
  }
}
