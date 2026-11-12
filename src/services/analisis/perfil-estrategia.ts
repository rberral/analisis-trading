/**
 * Perfil de la operativa: cómo operas (duración, horarios, riesgo planificado) y
 * desde dónde entras respecto a las velas recientes. Es una descripción de lo que
 * hacen los datos, no una afirmación sobre una estrategia concreta.
 */
import type { ESTRATEGIA } from '../../config/app-config';
import type { OperacionGuardada } from '../../models/operacion';
import type { VentanaVelas } from '../../models/velas';

type Parametros = typeof ESTRATEGIA;

export type EstiloTemporal = 'scalping' | 'intradia' | 'swing';

export interface EntradasRespectoARango {
  readonly muestras: number;
  /** Compras en máximos o ventas en mínimos de las últimas velas: seguir el movimiento. */
  readonly seguimiento: number;
  /** Compras en mínimos o ventas en máximos: entrar contra el último movimiento. */
  readonly contraMovimiento: number;
  readonly enMedio: number;
}

/** % de operaciones según lo que tardan en cerrarse (suman 100). */
export interface DistribucionDuracion {
  readonly menosDeScalping: number;
  readonly mismoDia: number;
  readonly undiaOMas: number;
}

export interface PerfilEstrategia {
  readonly totalOperaciones: number;
  readonly estilo: EstiloTemporal;
  readonly duracionMedianaMinutos: number;
  readonly distribucionDuracion: DistribucionDuracion;
  readonly operacionesPorDiaActivo: number;
  readonly porcentajeCompras: number;
  readonly lotesMedianos: number;
  readonly porcentajeConStopLoss: number;
  readonly porcentajeConTakeProfit: number;
  /** TP / SL planificado, medido en operaciones cerradas por su stop (así el SL no se había movido). */
  readonly ratioPlanificado: number | null;
  readonly sesiones: ReadonlyArray<{ readonly nombre: string; readonly porcentaje: number }>;
  readonly entradas: EntradasRespectoARango | null;
}

function mediana(valores: readonly number[]): number {
  if (valores.length === 0) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const medio = ordenados.length >> 1;
  return ordenados.length % 2 === 1 ? ordenados[medio]! : (ordenados[medio - 1]! + ordenados[medio]!) / 2;
}

const MS_POR_MINUTO = 60_000;

function distribucion(duraciones: readonly number[], parametros: Parametros): DistribucionDuracion {
  const pct = (cuantas: number) => (cuantas / duraciones.length) * 100;
  const corta = duraciones.filter((m) => m < parametros.scalpingMinutos).length;
  const largas = duraciones.filter((m) => m >= parametros.intradiaMinutos).length;
  return { menosDeScalping: pct(corta), mismoDia: pct(duraciones.length - corta - largas), undiaOMas: pct(largas) };
}

/** Swing si una parte importante de las operaciones dura un día o más; si no, manda la mediana. */
export function estiloPorDuracion(minutos: number, reparto: DistribucionDuracion, parametros: Parametros): EstiloTemporal {
  if (reparto.undiaOMas >= parametros.swingPorcentajeMinimo) return 'swing';
  if (minutos < parametros.scalpingMinutos) return 'scalping';
  if (minutos < parametros.intradiaMinutos) return 'intradia';
  return 'swing';
}

function porcentajePorSesion(operaciones: readonly OperacionGuardada[], parametros: Parametros) {
  return parametros.sesiones.map((sesion) => {
    const dentro = operaciones.filter((operacion) => {
      const hora = new Date(operacion.aperturaUtc).getUTCHours();
      return hora >= sesion.desdeHora && hora < sesion.hastaHora;
    });
    return { nombre: sesion.nombre, porcentaje: (dentro.length / operaciones.length) * 100 };
  });
}

function ratioPlanificado(operaciones: readonly OperacionGuardada[]): number | null {
  const ratios: number[] = [];
  for (const o of operaciones) {
    if (o.cierrePor !== 'sl' || o.stopLoss === null || o.takeProfit === null) continue;
    const esCompra = o.tipo === 'compra';
    const riesgo = esCompra ? o.precioEntrada - o.stopLoss : o.stopLoss - o.precioEntrada;
    const objetivo = esCompra ? o.takeProfit - o.precioEntrada : o.precioEntrada - o.takeProfit;
    if (riesgo > 0 && objetivo > 0) ratios.push(objetivo / riesgo);
  }
  return ratios.length >= 5 ? mediana(ratios) : null;
}

/** Posición de la entrada dentro del rango de las velas completas anteriores: 0 = mínimo, 1 = máximo. */
function posicionEnRango(operacion: OperacionGuardada, ventana: VentanaVelas, duracionVelaMs: number, parametros: Parametros): number | null {
  const previas = ventana.velas.filter((vela) => vela.utcMs + duracionVelaMs <= operacion.aperturaUtc).slice(-parametros.velasPreviasEntrada);
  if (previas.length < parametros.minimoVelasPrevias) return null;
  const maximo = Math.max(...previas.map((vela) => vela.maximo));
  const minimo = Math.min(...previas.map((vela) => vela.minimo));
  if (maximo <= minimo) return null;
  return (operacion.precioEntrada - minimo) / (maximo - minimo);
}

function analizarEntradas(
  operaciones: readonly OperacionGuardada[],
  ventanas: ReadonlyMap<string, VentanaVelas>,
  duracionDe: (ventana: VentanaVelas) => number,
  parametros: Parametros,
): EntradasRespectoARango | null {
  let seguimiento = 0;
  let contraMovimiento = 0;
  let enMedio = 0;
  for (const operacion of operaciones) {
    const ventana = ventanas.get(operacion.id);
    if (!ventana) continue;
    const posicion = posicionEnRango(operacion, ventana, duracionDe(ventana), parametros);
    if (posicion === null) continue;
    // Para una venta, "estar arriba" es contra el movimiento; se invierte para tratar igual compras y ventas.
    const hacia = operacion.tipo === 'compra' ? posicion : 1 - posicion;
    if (hacia >= 1 - parametros.umbralExtremo) seguimiento += 1;
    else if (hacia <= parametros.umbralExtremo) contraMovimiento += 1;
    else enMedio += 1;
  }
  const muestras = seguimiento + contraMovimiento + enMedio;
  return muestras < parametros.minimoMuestrasEntradas ? null : { muestras, seguimiento, contraMovimiento, enMedio };
}

/** `operaciones`: cerradas. `duracionDe`: duración de la vela de cada ventana. Devuelve null si no hay operaciones. */
export function crearPerfil(
  operaciones: readonly OperacionGuardada[],
  ventanas: ReadonlyMap<string, VentanaVelas>,
  duracionDe: (ventana: VentanaVelas) => number,
  parametros: Parametros,
): PerfilEstrategia | null {
  if (operaciones.length === 0) return null;
  const duraciones = operaciones.map((o) => ((o.cierreUtc ?? o.aperturaUtc) - o.aperturaUtc) / MS_POR_MINUTO);
  const duracionMediana = mediana(duraciones);
  const reparto = distribucion(duraciones, parametros);
  const dias = new Set(operaciones.map((o) => new Date(o.aperturaUtc).toISOString().slice(0, 10)));
  const porcentaje = (cuantas: number) => (cuantas / operaciones.length) * 100;

  return {
    totalOperaciones: operaciones.length,
    estilo: estiloPorDuracion(duracionMediana, reparto, parametros),
    duracionMedianaMinutos: duracionMediana,
    distribucionDuracion: reparto,
    operacionesPorDiaActivo: operaciones.length / dias.size,
    porcentajeCompras: porcentaje(operaciones.filter((o) => o.tipo === 'compra').length),
    lotesMedianos: mediana(operaciones.map((o) => o.lotes)),
    porcentajeConStopLoss: porcentaje(operaciones.filter((o) => o.stopLoss !== null).length),
    porcentajeConTakeProfit: porcentaje(operaciones.filter((o) => o.takeProfit !== null).length),
    ratioPlanificado: ratioPlanificado(operaciones),
    sesiones: porcentajePorSesion(operaciones, parametros),
    entradas: analizarEntradas(operaciones, ventanas, duracionDe, parametros),
  };
}
