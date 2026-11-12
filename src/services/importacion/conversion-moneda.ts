/**
 * Convierte el resultado de las operaciones a la moneda de la cuenta cuando el informe
 * mezcla varias (Quantfury). Cada operación se convierte con el cambio del día de su cierre.
 * Si el cambio no se puede obtener (sin conexión), se pide al usuario uno fijo por moneda.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { MovimientoInforme, OperacionInforme } from '../../models/operacion';

/** Fuente externa de cambios diarios. Se aísla en un adaptador para poder cambiar de proveedor. */
export interface ProveedorTasasHistoricas {
  /** Cuántas unidades de `destino` vale una de `origen`, por fecha (AAAA-MM-DD) y solo en días con cotización. */
  obtenerSerie(origen: string, destino: string, desde: string, hasta: string): Promise<ReadonlyMap<string, number>>;
}

/** Faltan cambios para estas monedas: el usuario puede escribirlos a mano. */
export class ErrorCambioNecesario extends ErrorDeUsuario {
  constructor(
    mensaje: string,
    readonly monedas: readonly string[],
    readonly destino: string,
  ) {
    super(mensaje);
    this.name = 'ErrorCambioNecesario';
  }
}

export interface ResultadoConversion {
  readonly operaciones: readonly OperacionInforme[];
  readonly convertidas: number;
  readonly monedasConvertidas: readonly string[];
}

interface Parametros {
  readonly monedaCuenta: string;
  /** Monedas que se tratan como otra 1 a 1 (USDT = USD). */
  readonly equivalencias: Readonly<Record<string, string>>;
  /** Cambio fijo escrito por el usuario: cuántas unidades de la moneda de la cuenta vale una de cada moneda. */
  readonly cambiosManuales: Readonly<Record<string, number>>;
  readonly proveedor: ProveedorTasasHistoricas | null;
}

const redondear2 = (valor: number): number => Math.round(valor * 100) / 100;

/** Cambio vigente en `fecha`: el último disponible hasta ese día (fines de semana y festivos no cotizan). */
export function cambioDelDia(serie: ReadonlyMap<string, number>, fecha: string): number | null {
  let mejorFecha: string | null = null;
  let primeraFecha: string | null = null;
  for (const clave of serie.keys()) {
    if (primeraFecha === null || clave < primeraFecha) primeraFecha = clave;
    if (clave <= fecha && (mejorFecha === null || clave > mejorFecha)) mejorFecha = clave;
  }
  const elegida = mejorFecha ?? primeraFecha;
  return elegida === null ? null : (serie.get(elegida) ?? null);
}

const fechaDe = (operacion: OperacionInforme): string => (operacion.cierreBroker ?? operacion.aperturaBroker).slice(0, 10);

/** Algo con un importe en otra moneda: lo mínimo que hace falta saber para buscar su cambio. */
interface ImporteEnOtraMoneda {
  readonly moneda: string;
  /** AAAA-MM-DD */
  readonly fecha: string;
}

/**
 * Busca los cambios que hacen falta (o usa los escritos a mano) y devuelve una función que da el cambio de cada
 * importe. Lanza ErrorCambioNecesario si algún cambio automático no se puede obtener.
 */
async function prepararCambios(importes: readonly ImporteEnOtraMoneda[], parametros: Parametros): Promise<(moneda: string, fecha: string) => number> {
  const canonica = (moneda: string): string => parametros.equivalencias[moneda] ?? moneda;
  const destino = canonica(parametros.monedaCuenta);
  const monedas = [...new Set(importes.map((i) => canonica(i.moneda)))].sort();
  const series = new Map<string, ReadonlyMap<string, number>>();
  const sinCambio: string[] = [];
  for (const moneda of monedas) {
    if (parametros.cambiosManuales[moneda] !== undefined) continue;
    const fechas = importes.filter((i) => canonica(i.moneda) === moneda).map((i) => i.fecha).sort();
    try {
      if (!parametros.proveedor) throw new Error('Sin proveedor de cambios');
      series.set(moneda, await parametros.proveedor.obtenerSerie(moneda, destino, fechas[0]!, fechas[fechas.length - 1]!));
    } catch {
      sinCambio.push(moneda);
    }
  }
  if (sinCambio.length > 0) {
    throw new ErrorCambioNecesario(
      `No se han podido obtener los cambios de ${sinCambio.join(', ')} a ${destino} (sin conexión o servicio no disponible). Escribe un cambio fijo para cada una y vuelve a importar.`,
      sinCambio,
      destino,
    );
  }
  return (monedaOrigen, fecha) => {
    const moneda = canonica(monedaOrigen);
    const tasa = parametros.cambiosManuales[moneda] ?? cambioDelDia(series.get(moneda)!, fecha);
    if (tasa === null || !(tasa > 0)) throw new ErrorDeUsuario(`No hay cambio de ${moneda} a ${destino} para el ${fecha}.`);
    return tasa;
  };
}

const necesitaCambio = (moneda: string | undefined, parametros: Parametros): moneda is string =>
  moneda !== undefined && (parametros.equivalencias[moneda] ?? moneda) !== (parametros.equivalencias[parametros.monedaCuenta] ?? parametros.monedaCuenta);

export async function convertirOperaciones(operaciones: readonly OperacionInforme[], parametros: Parametros): Promise<ResultadoConversion> {
  const necesitan = operaciones.filter((o) => o.beneficio !== 0 && necesitaCambio(o.monedaOrigen, parametros));
  const tasaDe = await prepararCambios(necesitan.map((o) => ({ moneda: o.monedaOrigen!, fecha: fechaDe(o) })), parametros);

  const convertidasPorMoneda = new Set<string>();
  const resultado = operaciones.map((operacion) => {
    if (!necesitan.includes(operacion)) return operacion;
    const tasa = tasaDe(operacion.monedaOrigen!, fechaDe(operacion));
    convertidasPorMoneda.add(operacion.monedaOrigen!);
    return { ...operacion, beneficioOrigen: operacion.beneficio, beneficio: redondear2(operacion.beneficio * tasa), tipoCambio: tasa };
  });
  return { operaciones: resultado, convertidas: necesitan.length, monedasConvertidas: [...convertidasPorMoneda].sort() };
}

export interface ResultadoConversionMovimientos {
  readonly movimientos: readonly MovimientoInforme[];
  readonly convertidos: number;
}

/** Igual que con las operaciones, para los movimientos en otra moneda (los dividendos en euros de Quantfury). */
export async function convertirMovimientos(movimientos: readonly MovimientoInforme[], parametros: Parametros): Promise<ResultadoConversionMovimientos> {
  const necesitan = movimientos.filter((m) => m.importe !== 0 && necesitaCambio(m.monedaOrigen, parametros));
  const tasaDe = await prepararCambios(necesitan.map((m) => ({ moneda: m.monedaOrigen!, fecha: m.horaBroker.slice(0, 10) })), parametros);
  const resultado = movimientos.map((movimiento) =>
    necesitan.includes(movimiento) ? { ...movimiento, importe: redondear2(movimiento.importe * tasaDe(movimiento.monedaOrigen!, movimiento.horaBroker.slice(0, 10))) } : movimiento,
  );
  return { movimientos: resultado, convertidos: necesitan.length };
}
