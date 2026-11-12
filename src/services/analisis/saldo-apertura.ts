/**
 * Saldo de la cuenta en el momento de abrir una operación: ingresos/retiradas hechos hasta
 * entonces más el resultado neto de las operaciones ya cerradas.
 */
import type { OperacionGuardada } from '../../models/operacion';
import { netoDeOperacion } from '../estadisticas/calculadora-estadisticas';
import type { DatosGuardados } from '../consultas/puertos';

interface Evento {
  readonly utcMs: number;
  readonly importe: number;
}

export type CalculadorSaldo = (cuenta: string, utcMs: number) => number;

export function crearCalculadorSaldo(datos: DatosGuardados): CalculadorSaldo {
  const porCuenta = new Map<string, Evento[]>();
  const anadir = (cuenta: string, evento: Evento) => porCuenta.set(cuenta, [...(porCuenta.get(cuenta) ?? []), evento]);

  for (const m of datos.movimientos) anadir(m.cuenta, { utcMs: m.utcMs, importe: m.importe });
  for (const o of datos.operaciones) {
    if (o.cierreUtc !== null) anadir(o.cuenta, { utcMs: o.cierreUtc, importe: netoOperacion(o) });
  }

  // Eventos ordenados con saldo acumulado: cada consulta es una búsqueda binaria.
  const acumulados = new Map<string, { tiempos: number[]; saldos: number[] }>();
  for (const [cuenta, eventos] of porCuenta) {
    eventos.sort((a, b) => a.utcMs - b.utcMs);
    let saldo = 0;
    acumulados.set(cuenta, { tiempos: eventos.map((e) => e.utcMs), saldos: eventos.map((e) => (saldo += e.importe)) });
  }

  return (cuenta, utcMs) => {
    const serie = acumulados.get(cuenta);
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
