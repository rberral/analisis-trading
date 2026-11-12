/**
 * Saldo de la cuenta en el momento de abrir una operación: ingresos/retiradas hechos hasta
 * entonces más el resultado neto de las operaciones ya cerradas.
 * Si de la cuenta no se conoce ningún ingreso (Quantfury sin sus estados de cuenta) el saldo no se puede
 * saber y se devuelve 0, que quienes lo usan (break even) tratan como «desconocido».
 */
import { claveCuenta, type CuentaTrading } from '../../models/cuenta';
import type { OperacionGuardada } from '../../models/operacion';
import { movimientosVigentes } from './movimientos-vigentes';
import { netoDeOperacion } from '../estadisticas/calculadora-estadisticas';
import type { DatosGuardados } from '../consultas/puertos';

interface Evento {
  readonly utcMs: number;
  readonly importe: number;
}

export type CalculadorSaldo = (cuenta: CuentaTrading, utcMs: number) => number;

export function crearCalculadorSaldo(datos: DatosGuardados): CalculadorSaldo {
  const porCuenta = new Map<string, Evento[]>();
  const anadir = (cuenta: CuentaTrading, evento: Evento) => {
    const clave = claveCuenta(cuenta);
    porCuenta.set(clave, [...(porCuenta.get(clave) ?? []), evento]);
  };

  const movimientos = movimientosVigentes(datos.movimientos);
  const cuentasConIngresos = new Set(movimientos.map(claveCuenta));
  for (const m of movimientos) anadir(m, { utcMs: m.utcMs, importe: m.importe });
  for (const o of datos.operaciones) {
    if (o.cierreUtc !== null) anadir(o, { utcMs: o.cierreUtc, importe: netoOperacion(o) });
  }

  // Eventos ordenados con saldo acumulado: cada consulta es una búsqueda binaria.
  const acumulados = new Map<string, { tiempos: number[]; saldos: number[] }>();
  for (const [cuenta, eventos] of porCuenta) {
    eventos.sort((a, b) => a.utcMs - b.utcMs);
    let saldo = 0;
    acumulados.set(cuenta, { tiempos: eventos.map((e) => e.utcMs), saldos: eventos.map((e) => (saldo += e.importe)) });
  }

  return (cuenta, utcMs) => {
    const serie = cuentasConIngresos.has(claveCuenta(cuenta)) ? acumulados.get(claveCuenta(cuenta)) : undefined;
    if (!serie) return 0;
    let bajo = 0;
    let alto = serie.tiempos.length; // primer índice con tiempo > utcMs
    while (bajo < alto) {
      const medio = (bajo + alto) >> 1;
      if ((serie.tiempos[medio] ?? 0) <= utcMs) bajo = medio + 1;
      else alto = medio;
    }
    return bajo === 0 ? 0 : (serie.saldos[bajo - 1] ?? 0);
  };
}

export function netoOperacion(o: OperacionGuardada): number {
  return netoDeOperacion({ ...o, cierre: o.cierreUtc ?? 0 });
}
