/**
 * Clasifica cómo terminó cada operación según su resultado, no según la etiqueta de la plataforma.
 * MetaTrader marca como "stop loss" también los stops movidos a break even o a beneficio.
 *
 *   1. Break even: |resultado neto| menor que cierto % del saldo de la cuenta al abrir.
 *      Tiene prioridad sobre el resto (una salida manual casi a cero también es break even).
 *   2. Manual: la cerraste tú.
 *   3. Take profit si ganó, stop loss si perdió.
 * Es la misma regla que usa el script de TradingView, para que ambos coincidan.
 */
import type { ClasificacionCierre } from '../../models/filtro';
import type { OperacionGuardada } from '../../models/operacion';
import type { DatosGuardados } from '../consultas/puertos';
import { crearCalculadorSaldo, netoOperacion } from './saldo-apertura';

export interface ParametrosClasificacion {
  /** % del saldo al abrir por debajo del cual el resultado neto cuenta como break even. */
  readonly umbralBreakEvenPorcentaje: number;
}

type Clasificador = (operacion: OperacionGuardada) => ClasificacionCierre | null;

/** `datos` debe incluir todo lo guardado, no solo lo filtrado, para que el saldo sea correcto. */
export function crearClasificador(datos: DatosGuardados, parametros: ParametrosClasificacion): Clasificador {
  const saldoEn = crearCalculadorSaldo(datos);
  return (operacion) => {
    if (operacion.cierreUtc === null) return null;
    const neto = netoOperacion(operacion);
    const saldo = saldoEn(operacion, operacion.aperturaUtc);
    if (saldo > 0 && (Math.abs(neto) / saldo) * 100 < parametros.umbralBreakEvenPorcentaje) return 'break_even';
    if (operacion.cierrePor === 'manual' || operacion.cierrePor === null) return 'manual';
    return neto > 0 ? 'tp' : 'sl';
  };
}

export const TEXTO_CLASIFICACION: Record<ClasificacionCierre, string> = {
  tp: 'Take profit',
  sl: 'Stop loss',
  break_even: 'Break even',
  manual: 'Manual',
};
