/**
 * Convierte el resultado de las operaciones a la moneda de la cuenta cuando el informe
 * mezcla varias (Quantfury). Cada operación se convierte con el cambio del día de su cierre.
 * Si el cambio no se puede obtener (sin conexión), se pide al usuario uno fijo por moneda.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { OperacionInforme } from '../../models/operacion';

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

export async function convertirOperaciones(operaciones: readonly OperacionInforme[], parametros: Parametros): Promise<ResultadoConversion> {
  const canonica = (moneda: string): string => parametros.equivalencias[moneda] ?? moneda;
  const destino = canonica(parametros.monedaCuenta);
  const necesitan = operaciones.filter((o) => o.monedaOrigen !== undefined && o.beneficio !== 0 && canonica(o.monedaOrigen) !== destino);

  const monedas = [...new Set(necesitan.map((o) => canonica(o.monedaOrigen!)))].sort();
  const series = new Map<string, ReadonlyMap<string, number>>();
  const sinCambio: string[] = [];
  for (const moneda of monedas) {
    if (parametros.cambiosManuales[moneda] !== undefined) continue;
    const fechas = necesitan.filter((o) => canonica(o.monedaOrigen!) === moneda).map(fechaDe).sort();
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

  let convertidas = 0;
  const convertidasPorMoneda = new Set<string>();
  const resultado = operaciones.map((operacion) => {
    if (!necesitan.includes(operacion)) return operacion;
    const moneda = canonica(operacion.monedaOrigen!);
    const tasa = parametros.cambiosManuales[moneda] ?? cambioDelDia(series.get(moneda)!, fechaDe(operacion));
    if (tasa === null || !(tasa > 0)) throw new ErrorDeUsuario(`No hay cambio de ${moneda} a ${destino} para el ${fechaDe(operacion)}.`);
    convertidas++;
    convertidasPorMoneda.add(operacion.monedaOrigen!);
    return { ...operacion, beneficioOrigen: operacion.beneficio, beneficio: redondear2(operacion.beneficio * tasa), tipoCambio: tasa };
  });
  return { operaciones: resultado, convertidas, monedasConvertidas: [...convertidasPorMoneda].sort() };
}
