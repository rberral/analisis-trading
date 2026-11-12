/**
 * Aplica un filtro (periodo, activo, cuenta) a las operaciones guardadas y
 * calcula estadísticas y curva de balance. Código puro: no toca la base de datos.
 */
import { CLASIFICACION_CIERRE } from '../../config/app-config';
import { mismaCuenta, type CuentaTrading } from '../../models/cuenta';
import type { ClasificacionCierre, Filtro } from '../../models/filtro';
import { movimientosVigentes } from '../analisis/movimientos-vigentes';
import { crearClasificador } from '../analisis/clasificacion-cierre';
import type { EstadisticasOperaciones } from '../../models/estadisticas';
import type { MovimientoGuardado } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';
import { calcularEstadisticas, netoDeOperacion, redondear2 } from '../estadisticas/calculadora-estadisticas';
import type { DatosGuardados } from './puertos';
import { estaEnRango, rangoDePeriodo, type RangoUtc } from './periodos';

export interface PuntoBalance {
  readonly utcMs: number;
  readonly balance: number;
}

export interface AnalisisPeriodo {
  /** Operaciones cerradas dentro del periodo, ordenadas por cierre. */
  readonly operaciones: readonly OperacionGuardada[];
  /** Operaciones que siguen abiertas (el periodo no se les aplica: aún no tienen cierre). */
  readonly abiertas: readonly OperacionGuardada[];
  readonly estadisticas: EstadisticasOperaciones;
  /** Balance de las operaciones al cierre de cada una, partiendo de balanceInicial. */
  readonly curva: readonly PuntoBalance[];
  readonly balanceInicial: number;
  /** Cómo terminó cada operación cerrada del filtro (id → clasificación). */
  readonly clasificacion: ReadonlyMap<string, ClasificacionCierre>;
}

export interface OpcionesDelFiltro {
  readonly activos: readonly string[];
  readonly anios: readonly number[];
}

const neto = (operacion: OperacionGuardada): number =>
  netoDeOperacion({ ...operacion, cierre: operacion.cierreUtc ?? 0 });

function porCierre(a: OperacionGuardada, b: OperacionGuardada): number {
  return (a.cierreUtc ?? 0) - (b.cierreUtc ?? 0) || a.ticket.localeCompare(b.ticket, 'en', { numeric: true });
}

function suma(valores: readonly number[]): number {
  return redondear2(valores.reduce((total, valor) => total + valor, 0));
}

/**
 * Balance con el que empieza el periodo. Sin límite inferior es el de la
 * plataforma (ingresos anteriores a la primera operación); con límite, todo lo
 * ocurrido antes (ingresos y resultado de las operaciones de cualquier activo).
 */
function balanceInicialDelPeriodo(
  operacionesCuenta: readonly OperacionGuardada[],
  movimientos: readonly MovimientoGuardado[],
  desdeMs: number | null,
): number {
  if (desdeMs === null) {
    if (operacionesCuenta.length === 0) return 0;
    const primera = Math.min(...operacionesCuenta.map((operacion) => operacion.aperturaUtc));
    return suma(movimientos.filter((m) => m.utcMs < primera).map((m) => m.importe));
  }
  const ingresos = movimientos.filter((m) => m.utcMs < desdeMs).map((m) => m.importe);
  const anteriores = operacionesCuenta
    .filter((o) => o.cierreUtc !== null && o.cierreUtc < desdeMs)
    .map(neto);
  return suma([...ingresos, ...anteriores]);
}

function crearCurva(operaciones: readonly OperacionGuardada[], balanceInicial: number): PuntoBalance[] {
  let balance = balanceInicial;
  return operaciones.map((operacion) => {
    balance = redondear2(balance + neto(operacion));
    return { utcMs: operacion.cierreUtc ?? 0, balance };
  });
}

/** Devuelve el análisis, o un mensaje de error si el periodo del filtro no es válido. */
export function analizarPeriodo(datos: DatosGuardados, filtro: Filtro): AnalisisPeriodo | string {
  const rango: RangoUtc | string = rangoDePeriodo(filtro.periodo);
  if (typeof rango === 'string') return rango;

  const deLaCuenta = (cuenta: CuentaTrading) => filtro.cuenta === null || mismaCuenta(cuenta, filtro.cuenta);
  const operacionesCuenta = datos.operaciones.filter((o) => deLaCuenta(o));
  const movimientos = movimientosVigentes(datos.movimientos).filter((m) => deLaCuenta(m));
  const deLActivo = (o: OperacionGuardada) => filtro.activo === null || o.activo === filtro.activo;

  // El saldo al abrir se calcula con todo lo guardado, no solo con lo filtrado.
  const clasificar = crearClasificador(datos, CLASIFICACION_CIERRE);
  const cumpleCierre = (o: OperacionGuardada) => filtro.cierre === null || clasificar(o) === filtro.cierre;

  const operaciones = operacionesCuenta
    .filter((o) => o.cierreUtc !== null && estaEnRango(o.cierreUtc, rango) && deLActivo(o) && cumpleCierre(o))
    .sort(porCierre);
  // Una operación abierta aún no tiene tipo de cierre: con ese filtro activo no se muestran.
  const abiertas = filtro.cierre === null ? operacionesCuenta.filter((o) => o.cierreUtc === null && deLActivo(o)) : [];
  const clasificacion = new Map<string, ClasificacionCierre>();
  for (const operacion of operaciones) {
    const clase = clasificar(operacion);
    if (clase) clasificacion.set(operacion.id, clase);
  }

  const balanceInicial = balanceInicialDelPeriodo(operacionesCuenta, movimientos, rango.desdeMs);
  const estadisticas = calcularEstadisticas(
    operaciones.map((o) => ({ ...o, cierre: o.cierreUtc ?? 0 })),
    balanceInicial,
  );
  return { operaciones, abiertas, estadisticas, curva: crearCurva(operaciones, balanceInicial), balanceInicial, clasificacion };
}

/** Valores que se ofrecen en los selectores del filtro, solo de la cuenta elegida (null = todas). */
export function opcionesDelFiltro(datos: DatosGuardados, cuenta: CuentaTrading | null): OpcionesDelFiltro {
  const operaciones = datos.operaciones.filter((o) => cuenta === null || mismaCuenta(o, cuenta));
  const cierres = operaciones.flatMap((o) => (o.cierreUtc === null ? [] : [o.cierreUtc]));
  const anios = [...new Set(cierres.map((ms) => new Date(ms).getUTCFullYear()))].sort((a, b) => b - a);
  return { activos: [...new Set(operaciones.map((o) => o.activo))].sort(), anios };
}
