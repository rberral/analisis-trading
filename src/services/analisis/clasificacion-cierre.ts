/**
 * Clasifica cómo terminó cada operación según su resultado, no según la etiqueta de la plataforma.
 * MetaTrader marca como "stop loss" también los stops movidos a break even o a beneficio, y
 * eso hacía que operaciones ganadoras aparecieran como "Stop Loss".
 *
 *   - Cierre manual: siempre "manual".
 *   - Cierre automático (stop o take profit) con un resultado casi nulo: "break even".
 *   - Resto: "take profit" si ganó y "stop loss" si perdió.
 * "Casi nulo" = el movimiento de precio vale menos que cierto % del valor de la posición.
 */
import type { ClasificacionCierre } from '../../models/filtro';
import type { OperacionGuardada } from '../../models/operacion';

export interface ParametrosClasificacion {
  /** % del valor de la posición por debajo del cual el resultado cuenta como break even. */
  readonly umbralBreakEvenPorcentaje: number;
}

type Clasificador = (operacion: OperacionGuardada) => ClasificacionCierre | null;

function mediana(valores: readonly number[]): number {
  const ordenados = [...valores].sort((a, b) => a - b);
  return ordenados[ordenados.length >> 1] ?? 0;
}

/**
 * Cuánto dinero vale mover el precio una unidad con un lote, por activo. El informe no trae el
 * tamaño del contrato, pero se deduce de las propias operaciones (beneficio / movimiento / lotes).
 */
export function dineroPorUnidadDePrecio(operaciones: readonly OperacionGuardada[]): Map<string, number> {
  const ratios = new Map<string, number[]>();
  for (const operacion of operaciones) {
    if (operacion.precioCierre === null) continue;
    const movimiento = (operacion.tipo === 'compra' ? 1 : -1) * (operacion.precioCierre - operacion.precioEntrada);
    if (Math.abs(movimiento) < 1e-9 || operacion.beneficio === 0 || operacion.lotes <= 0) continue;
    const ratio = operacion.beneficio / (movimiento * operacion.lotes);
    if (ratio > 0) ratios.set(operacion.activo, [...(ratios.get(operacion.activo) ?? []), ratio]);
  }
  return new Map([...ratios].map(([activo, lista]) => [activo, mediana(lista)]));
}

/** `todas` debe incluir todas las operaciones guardadas, no solo las filtradas, para deducir bien el contrato. */
export function crearClasificador(todas: readonly OperacionGuardada[], parametros: ParametrosClasificacion): Clasificador {
  const valorPorUnidad = dineroPorUnidadDePrecio(todas);
  return (operacion) => {
    if (operacion.cierreUtc === null) return null;
    if (operacion.cierrePor === 'manual' || operacion.cierrePor === null) return 'manual';
    const contrato = valorPorUnidad.get(operacion.activo);
    if (contrato !== undefined) {
      const valorPosicion = operacion.lotes * contrato * operacion.precioEntrada;
      const porcentaje = (Math.abs(operacion.beneficio) / valorPosicion) * 100;
      if (porcentaje < parametros.umbralBreakEvenPorcentaje) return 'break_even';
    }
    return operacion.beneficio > 0 ? 'tp' : 'sl';
  };
}

export const TEXTO_CLASIFICACION: Record<ClasificacionCierre, string> = {
  tp: 'Take profit',
  sl: 'Stop loss',
  break_even: 'Break even',
  manual: 'Manual',
};
