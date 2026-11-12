/**
 * Carga de un fichero de velas en dos pasos, para que el usuario vea antes de
 * guardar si el horario encaja:
 *   1. analizar: lee, convierte a UTC, comprueba el horario y prepara las ventanas.
 *   2. guardar: guarda solo las ventanas de velas y los datos de la carga.
 * El fichero de velas completo nunca se guarda.
 */
import { VELAS, type OpcionTemporalidad } from '../../config/app-config';
import { ErrorDeUsuario } from '../../core/errores';
import { convertirHoraBrokerAUtc, validarHorario, type HorarioBroker } from '../../core/horario';
import { logger } from '../../core/logger';
import type { OperacionGuardada } from '../../models/operacion';
import type { RegistroCargaVelas, Temporalidad, Vela, VelaBroker, VentanaVelas } from '../../models/velas';
import type { LectorDatos } from '../consultas/puertos';
import { comprobarHorario, puntosDeOperaciones, type ComprobacionHorario } from './comprobacion-horario';
import type { ParserVelas, RepositorioVelas } from './puertos';
import { crearVentanas } from './ventanas';

export interface OpcionesCargaVelas {
  readonly activo: string;
  readonly temporalidad: Temporalidad;
  readonly broker: string | null;
  readonly horario: HorarioBroker;
  readonly nombreFichero: string;
}

export interface AnalisisCargaVelas {
  readonly registro: RegistroCargaVelas;
  readonly ventanas: readonly VentanaVelas[];
  readonly operacionesDelActivo: number;
  readonly operacionesFueraDeRango: number;
  readonly velasAGuardar: number;
  readonly comprobacion: ComprobacionHorario;
  readonly avisos: readonly string[];
}

const MS_POR_HORA = 3_600_000;

interface VelasConvertidas {
  readonly velas: Vela[];
  readonly horasInexistentes: number;
  readonly horasRepetidasResueltas: number;
  readonly velasDescartadas: number;
}

/**
 * Convierte las horas a UTC. Si una hora del broker puede ser dos instantes (cambio
 * de hora de otoño), se usa el orden del fichero: la segunda vez que aparece es la segunda.
 */
function convertirVelas(velasBroker: readonly VelaBroker[], horario: HorarioBroker): VelasConvertidas {
  const velas: Vela[] = [];
  let horasInexistentes = 0;
  let horasRepetidasResueltas = 0;
  let velasDescartadas = 0;
  let ultimoUtc = -Infinity;
  for (const vela of velasBroker) {
    const conversion = convertirHoraBrokerAUtc(vela.horaBroker, horario);
    if (conversion.estado === 'inexistente') horasInexistentes += 1;
    let utcMs = conversion.utcMs;
    if (conversion.estado === 'ambigua' && utcMs <= ultimoUtc) {
      utcMs += MS_POR_HORA;
      horasRepetidasResueltas += 1;
    }
    if (utcMs <= ultimoUtc) {
      velasDescartadas += 1;
      continue;
    }
    ultimoUtc = utcMs;
    velas.push({ utcMs, abre: vela.abre, maximo: vela.maximo, minimo: vela.minimo, cierra: vela.cierra, volumen: vela.volumen });
  }
  return { velas, horasInexistentes, horasRepetidasResueltas, velasDescartadas };
}

function crearAvisos(conversion: VelasConvertidas): string[] {
  const avisos: string[] = [];
  if (conversion.horasInexistentes > 0) {
    avisos.push(
      `${conversion.horasInexistentes} velas están en una hora que no existe con el horario indicado (salto de hora de primavera). Revisa que el horario sea el correcto.`,
    );
  }
  if (conversion.horasRepetidasResueltas > 0) {
    avisos.push(`${conversion.horasRepetidasResueltas} velas caen en la hora repetida del cambio de otoño; se ha usado el orden del fichero para situarlas.`);
  }
  if (conversion.velasDescartadas > 0) {
    avisos.push(`${conversion.velasDescartadas} velas se han descartado por repetir una hora ya leída.`);
  }
  return avisos;
}

export class ServicioVelas {
  constructor(
    private readonly parser: ParserVelas,
    private readonly lector: LectorDatos,
    private readonly repositorio: RepositorioVelas,
    private readonly temporalidades: readonly OpcionTemporalidad[],
  ) {}

  async analizar(contenido: string, opciones: OpcionesCargaVelas): Promise<AnalisisCargaVelas> {
    const activo = opciones.activo.trim().toUpperCase();
    if (activo === '') throw new ErrorDeUsuario('Indica el activo del fichero de velas.');
    const mensajeHorario = validarHorario(opciones.horario);
    if (mensajeHorario) throw new ErrorDeUsuario(mensajeHorario);
    const duracionVelaMs = this.duracionDe(opciones.temporalidad);

    const conversion = convertirVelas(this.parser.leer(contenido), opciones.horario);
    const primera = conversion.velas[0];
    const ultima = conversion.velas[conversion.velas.length - 1];
    if (!primera || !ultima) throw new ErrorDeUsuario('No se ha podido leer ninguna vela del fichero.');

    const operaciones = await this.operacionesCerradasDe(activo);
    const cargaId = crypto.randomUUID();
    const ventanas = crearVentanas(conversion.velas, operaciones, opciones.temporalidad, cargaId, {
      duracionVelaMs,
      margenVelas: VELAS.margenVelas,
      maximoVelas: VELAS.maximoVelasPorVentana,
    });
    const comprobacion = comprobarHorario(conversion.velas, puntosDeOperaciones(operaciones), {
      duracionVelaMs,
      toleranciaPrecio: VELAS.toleranciaPrecio,
      desfasesHoras: VELAS.desfasesHoras,
      minimoComprobaciones: VELAS.minimoComprobaciones,
      porcentajeMinimoCorrecto: VELAS.porcentajeMinimoCorrecto,
    });
    const velasAGuardar = ventanas.ventanas.reduce((total, ventana) => total + ventana.velas.length, 0);

    return {
      registro: {
        id: cargaId,
        activo,
        temporalidad: opciones.temporalidad,
        broker: opciones.broker,
        horario: opciones.horario,
        nombreFichero: opciones.nombreFichero,
        fechaMs: Date.now(),
        velasLeidas: conversion.velas.length,
        primeraVelaUtc: primera.utcMs,
        ultimaVelaUtc: ultima.utcMs,
        operacionesCubiertas: ventanas.cubiertas,
        ventanasGuardadas: ventanas.ventanas.length,
      },
      ventanas: ventanas.ventanas,
      operacionesDelActivo: operaciones.length,
      operacionesFueraDeRango: ventanas.fueraDeRango,
      velasAGuardar,
      comprobacion,
      avisos: crearAvisos(conversion),
    };
  }

  async guardar(analisis: AnalisisCargaVelas): Promise<void> {
    await this.repositorio.guardarCarga(analisis.registro, analisis.ventanas);
    logger.info(`Velas guardadas: ${analisis.registro.activo} ${analisis.registro.temporalidad}, ${analisis.ventanas.length} ventanas`);
  }

  listarCargas(): Promise<RegistroCargaVelas[]> {
    return this.repositorio.listarCargas();
  }

  private duracionDe(temporalidad: Temporalidad): number {
    const opcion = this.temporalidades.find((candidata) => candidata.valor === temporalidad);
    if (!opcion) throw new ErrorDeUsuario('Elige la temporalidad del fichero de velas.');
    return opcion.minutos * 60_000;
  }

  private async operacionesCerradasDe(activo: string): Promise<OperacionGuardada[]> {
    const datos = await this.lector.leerTodo();
    return datos.operaciones.filter((operacion) => operacion.activo === activo && operacion.cierreUtc !== null);
  }
}
