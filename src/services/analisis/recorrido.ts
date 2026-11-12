/**
 * Recorrido máximo (MFE/MAE) y qué hizo el precio tras una salida manual.
 * Funciones puras: reciben la operación y sus velas.
 */
import type { EvaluacionSalida, Recorrido } from '../../models/analisis-operacion';
import type { OperacionGuardada } from '../../models/operacion';
import type { Vela } from '../../models/velas';

function porcentajeDelCamino(recorrido: number, distancia: number | null): number | null {
  if (distancia === null || distancia <= 0) return null;
  return (recorrido / distancia) * 100;
}

/**
 * Solo cuentan las velas completas dentro de la operación: la vela en la que se
 * entra o se sale mezcla precios de antes o después. Por eso el resultado es un
 * mínimo: se incluyen además los precios exactos de entrada y salida.
 * Un stop loss movido a break even deja distancia 0 y el porcentaje no se calcula.
 */
export function calcularRecorrido(operacion: OperacionGuardada, velas: readonly Vela[], duracionVelaMs: number): Recorrido | null {
  if (operacion.cierreUtc === null || operacion.precioCierre === null) return null;
  const cierre = operacion.cierreUtc;
  const dentro = velas.filter((vela) => vela.utcMs >= operacion.aperturaUtc && vela.utcMs + duracionVelaMs <= cierre);
  const maximo = Math.max(operacion.precioEntrada, operacion.precioCierre, ...dentro.map((vela) => vela.maximo));
  const minimo = Math.min(operacion.precioEntrada, operacion.precioCierre, ...dentro.map((vela) => vela.minimo));

  const esCompra = operacion.tipo === 'compra';
  const mfe = esCompra ? maximo - operacion.precioEntrada : operacion.precioEntrada - minimo;
  const mae = esCompra ? operacion.precioEntrada - minimo : maximo - operacion.precioEntrada;
  const distanciaTp = operacion.takeProfit === null ? null : esCompra ? operacion.takeProfit - operacion.precioEntrada : operacion.precioEntrada - operacion.takeProfit;
  const distanciaSl = operacion.stopLoss === null ? null : esCompra ? operacion.precioEntrada - operacion.stopLoss : operacion.stopLoss - operacion.precioEntrada;

  return {
    mfe,
    mae,
    mfePorcentajeTp: porcentajeDelCamino(mfe, distanciaTp),
    maePorcentajeSl: porcentajeDelCamino(mae, distanciaSl),
    velasUsadas: dentro.length,
  };
}

/**
 * Para operaciones cerradas a mano con take profit: ¿llegó el precio al TP (o al SL)
 * en las velas guardadas después del cierre? Si en una misma vela toca los dos, se da
 * por bueno el SL: es lo prudente y no se acusa al usuario de cerrar pronto sin estar seguros.
 */
export function evaluarSalidaPosterior(operacion: OperacionGuardada, velas: readonly Vela[]): EvaluacionSalida {
  const noAplica: EvaluacionSalida = { resultado: 'no_aplica', velasMiradas: 0 };
  if (operacion.cierrePor !== 'manual' || operacion.takeProfit === null || operacion.cierreUtc === null) return noAplica;
  const cierre = operacion.cierreUtc;
  const posteriores = velas.filter((vela) => vela.utcMs >= cierre);
  const esCompra = operacion.tipo === 'compra';
  const tp = operacion.takeProfit;
  const sl = operacion.stopLoss;

  for (const vela of posteriores) {
    const tocaSl = sl !== null && (esCompra ? vela.minimo <= sl : vela.maximo >= sl);
    if (tocaSl) return { resultado: 'sl_alcanzado', velasMiradas: posteriores.length };
    const tocaTp = esCompra ? vela.maximo >= tp : vela.minimo <= tp;
    if (tocaTp) return { resultado: 'tp_alcanzado', velasMiradas: posteriores.length };
  }
  return { resultado: 'ninguno', velasMiradas: posteriores.length };
}
