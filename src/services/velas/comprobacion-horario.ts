/**
 * Comprueba si el horario declarado para el fichero de velas es el correcto.
 *
 * Idea: el precio de entrada y el de salida de cada operación tienen que estar
 * dentro de la vela que corresponde a ese momento. Si el horario está mal, las
 * velas quedan desplazadas y casi ninguno encaja. Se prueban también desfases de
 * unas horas para poder decirle al usuario cuál encaja mejor, pero NO se corrige
 * nada por su cuenta.
 */
import type { OperacionGuardada } from '../../models/operacion';
import type { Vela } from '../../models/velas';

export interface PuntoAComprobar {
  readonly utcMs: number;
  readonly precio: number;
}

export interface ResultadoDesfase {
  readonly desfaseHoras: number;
  readonly encajan: number;
  readonly comprobados: number;
  /** null si no hay nada que comprobar. */
  readonly porcentaje: number | null;
}

export type Veredicto = 'correcto' | 'sospechoso' | 'no_concluyente';

export interface ComprobacionHorario {
  readonly resultados: readonly ResultadoDesfase[];
  readonly veredicto: Veredicto;
  /** Desfase con mejor porcentaje (null si no concluyente). */
  readonly mejorDesfaseHoras: number | null;
}

export interface ParametrosComprobacion {
  readonly duracionVelaMs: number;
  readonly toleranciaPrecio: number;
  readonly desfasesHoras: readonly number[];
  readonly minimoComprobaciones: number;
  readonly porcentajeMinimoCorrecto: number;
}

const MS_POR_HORA = 3_600_000;

/** Entrada y salida de las operaciones cerradas: los precios que deben estar dentro de alguna vela. */
export function puntosDeOperaciones(operaciones: readonly OperacionGuardada[]): PuntoAComprobar[] {
  const puntos: PuntoAComprobar[] = [];
  for (const operacion of operaciones) {
    if (operacion.cierreUtc === null || operacion.precioCierre === null) continue;
    puntos.push({ utcMs: operacion.aperturaUtc, precio: operacion.precioEntrada });
    puntos.push({ utcMs: operacion.cierreUtc, precio: operacion.precioCierre });
  }
  return puntos;
}

/** Busca (por bisección) la vela que contiene el instante, si las velas estuvieran desplazadas `desfaseMs`. */
function buscarVela(velas: readonly Vela[], instanteMs: number, desfaseMs: number, duracionMs: number): Vela | null {
  const objetivo = instanteMs - desfaseMs;
  let bajo = 0;
  let alto = velas.length - 1;
  let encontrada: Vela | null = null;
  while (bajo <= alto) {
    const medio = (bajo + alto) >> 1;
    const vela = velas[medio]!;
    if (vela.utcMs <= objetivo) {
      encontrada = vela;
      bajo = medio + 1;
    } else {
      alto = medio - 1;
    }
  }
  return encontrada && objetivo < encontrada.utcMs + duracionMs ? encontrada : null;
}

function probarDesfase(
  velas: readonly Vela[],
  puntos: readonly PuntoAComprobar[],
  desfaseHoras: number,
  parametros: ParametrosComprobacion,
): ResultadoDesfase {
  let comprobados = 0;
  let encajan = 0;
  for (const punto of puntos) {
    const vela = buscarVela(velas, punto.utcMs, desfaseHoras * MS_POR_HORA, parametros.duracionVelaMs);
    if (!vela) continue; // El punto cae fuera del rango del fichero: no cuenta ni a favor ni en contra.
    comprobados += 1;
    const margen = punto.precio * parametros.toleranciaPrecio;
    if (punto.precio >= vela.minimo - margen && punto.precio <= vela.maximo + margen) encajan += 1;
  }
  const porcentaje = comprobados === 0 ? null : (encajan / comprobados) * 100;
  return { desfaseHoras, encajan, comprobados, porcentaje };
}

/** `velas` debe estar ordenada por hora y `puntos` ser del mismo activo que las velas. */
export function comprobarHorario(
  velas: readonly Vela[],
  puntos: readonly PuntoAComprobar[],
  parametros: ParametrosComprobacion,
): ComprobacionHorario {
  const resultados = parametros.desfasesHoras.map((desfase) => probarDesfase(velas, puntos, desfase, parametros));
  const sinDesfase = resultados.find((resultado) => resultado.desfaseHoras === 0);
  if (!sinDesfase || sinDesfase.comprobados < parametros.minimoComprobaciones) {
    return { resultados, veredicto: 'no_concluyente', mejorDesfaseHoras: null };
  }
  const conPorcentaje = resultados.filter((r) => r.porcentaje !== null && r.comprobados >= parametros.minimoComprobaciones);
  const mejor = conPorcentaje.reduce((a, b) => ((b.porcentaje ?? 0) > (a.porcentaje ?? 0) ? b : a), sinDesfase);
  const correcto = mejor.desfaseHoras === 0 && (sinDesfase.porcentaje ?? 0) >= parametros.porcentajeMinimoCorrecto;
  return { resultados, veredicto: correcto ? 'correcto' : 'sospechoso', mejorDesfaseHoras: mejor.desfaseHoras };
}
