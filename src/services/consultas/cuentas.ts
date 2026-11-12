/** Qué cuentas (broker + cuenta) hay guardadas y cuál está elegida. */
import { claveCuenta, mismaCuenta, type CuentaTrading } from '../../models/cuenta';
import type { Filtro } from '../../models/filtro';
import type { DatosGuardados } from './puertos';

export function listarCuentas(datos: DatosGuardados): CuentaTrading[] {
  const unicas = new Map<string, CuentaTrading>();
  for (const o of [...datos.operaciones, ...datos.movimientos]) {
    unicas.set(claveCuenta(o), { broker: o.broker, cuenta: o.cuenta });
  }
  return [...unicas.values()].sort((a, b) => a.broker.localeCompare(b.broker) || a.cuenta.localeCompare(b.cuenta));
}

/**
 * Las pantallas siempre trabajan con una sola cuenta para no mezclar estrategias:
 * si el filtro no tiene una cuenta válida, se elige la primera.
 */
export function asegurarCuenta(filtro: Filtro, cuentas: readonly CuentaTrading[]): Filtro {
  const actual = filtro.cuenta;
  if (actual !== null && cuentas.some((c) => mismaCuenta(c, actual))) return filtro;
  return { ...filtro, cuenta: cuentas[0] ?? null, activo: null };
}
