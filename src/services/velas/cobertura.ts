/** Qué operaciones cerradas todavía no tienen velas guardadas, agrupadas por activo. */
import type { OperacionGuardada } from '../../models/operacion';
import type { VentanaVelas } from '../../models/velas';

export interface OperacionesSinVelas {
  readonly activo: string;
  readonly cantidad: number;
}

/**
 * Las velas se guardan solo para las operaciones que existen al cargar el fichero de velas, así que las
 * operaciones importadas después no tienen velas hasta que se vuelve a cargar el fichero de su activo.
 */
export function operacionesSinVelas(operaciones: readonly OperacionGuardada[], ventanas: readonly VentanaVelas[]): OperacionesSinVelas[] {
  const conVelas = new Set(ventanas.map((v) => v.operacionId));
  const porActivo = new Map<string, number>();
  for (const operacion of operaciones) {
    if (operacion.cierreUtc === null || conVelas.has(operacion.id)) continue;
    porActivo.set(operacion.activo, (porActivo.get(operacion.activo) ?? 0) + 1);
  }
  return [...porActivo].map(([activo, cantidad]) => ({ activo, cantidad })).sort((a, b) => a.activo.localeCompare(b.activo));
}
