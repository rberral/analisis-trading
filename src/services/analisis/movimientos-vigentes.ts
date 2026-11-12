/**
 * Quita los movimientos que se contarían dos veces. En Quantfury, el informe de efectivo da cada traspaso con su
 * hora y el de trading solo el total de cada año: si un año ya tiene traspasos con hora, su total anual sobra.
 */
import { claveCuenta } from '../../models/cuenta';
import type { MovimientoGuardado } from '../../models/importacion';

const anioUtc = (utcMs: number): number => new Date(utcMs).getUTCFullYear();

export function movimientosVigentes(movimientos: readonly MovimientoGuardado[]): readonly MovimientoGuardado[] {
  if (!movimientos.some((m) => m.clase === 'anual')) return movimientos;
  const conTraspasos = new Set(movimientos.filter((m) => m.clase === 'traspaso').map((m) => `${claveCuenta(m)}|${anioUtc(m.utcMs)}`));
  return movimientos.filter((m) => m.clase !== 'anual' || !conTraspasos.has(`${claveCuenta(m)}|${anioUtc(m.utcMs)}`));
}
