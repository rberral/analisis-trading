/**
 * Saldo de una cuenta para el Panel: lo que se puede calcular con lo importado (ingresos, retiradas, dividendos
 * y resultado de lo cerrado) comparado con el que da el broker, más las cifras que solo se muestran.
 * Las ganancias no realizadas y el apalancamiento son informativos: no entran en ningún otro cálculo.
 */
import type { CuentaTrading } from '../../models/cuenta';
import { mismaCuenta } from '../../models/cuenta';
import type { RegistroImportacion } from '../../models/importacion';
import type { DatosGuardados } from '../consultas/puertos';
import { redondear2 } from '../estadisticas/calculadora-estadisticas';
import { crearCalculadorSaldo } from './saldo-apertura';

export interface ResumenSaldo {
  /** Saldo en efectivo de la cuenta, sin apalancamiento y sin ganancias no realizadas. null si no hay saldo del broker. */
  readonly saldoDisponible: number | null;
  /** Saldo que da el broker (incluye las no realizadas), su fecha y las no realizadas. Solo informativos. */
  readonly patrimonio: number | null;
  readonly noRealizadas: number | null;
  readonly fechaUtcMs: number | null;
  /** Saldo calculado menos el del broker en esa fecha; null si no hay saldo del broker. */
  readonly diferencia: number | null;
  /** true si el saldo calculado cuadra con el del broker (dentro de la tolerancia). */
  readonly cuadra: boolean | null;
  /** true si los ingresos y retiradas se conocen con su hora (estado de efectivo importado). */
  readonly ingresosConHora: boolean;
  readonly apalancamiento: number | null;
}

const MAXIMO = Number.MAX_SAFE_INTEGER;

/** El dato más reciente (por fecha de importación) de la cuenta que cumple `tiene`. */
function masReciente(registros: readonly RegistroImportacion[], tiene: (r: RegistroImportacion) => boolean): RegistroImportacion | undefined {
  return registros.filter(tiene).sort((a, b) => b.fechaMs - a.fechaMs)[0];
}

/** null si no hay nada que mostrar (ni saldo del broker ni apalancamiento). */
export function resumirSaldo(datos: DatosGuardados, cuenta: CuentaTrading, tolerancia: number): ResumenSaldo | null {
  const registros = (datos.importaciones ?? []).filter((r) => mismaCuenta(r, cuenta));
  const conResumen = masReciente(registros, (r) => r.resumenCuenta !== undefined)?.resumenCuenta ?? null;
  const apalancamiento = masReciente(registros, (r) => r.apalancamiento !== undefined && r.apalancamiento !== null)?.apalancamiento ?? null;
  if (conResumen === null && apalancamiento === null) return null;

  const ingresosConHora = datos.movimientos.some((m) => m.clase === 'traspaso' && mismaCuenta(m, cuenta));
  if (conResumen === null) {
    return { saldoDisponible: null, patrimonio: null, noRealizadas: null, fechaUtcMs: null, diferencia: null, cuadra: null, ingresosConHora, apalancamiento };
  }
  const saldoEn = crearCalculadorSaldo(datos);
  const delBroker = redondear2(conResumen.patrimonio - conResumen.noRealizadas);
  const diferencia = redondear2(saldoEn(cuenta, conResumen.fechaUtcMs) - delBroker);
  return {
    saldoDisponible: redondear2(saldoEn(cuenta, MAXIMO)),
    patrimonio: conResumen.patrimonio,
    noRealizadas: conResumen.noRealizadas,
    fechaUtcMs: conResumen.fechaUtcMs,
    diferencia,
    cuadra: Math.abs(diferencia) <= tolerancia,
    ingresosConHora,
    apalancamiento,
  };
}
