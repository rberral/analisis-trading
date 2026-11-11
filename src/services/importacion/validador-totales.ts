/**
 * Comprueba que las cifras recalculadas a partir de las operaciones importadas
 * coinciden con las que trae el propio informe. Si no coinciden, puede que se
 * haya perdido o duplicado alguna operación.
 */
import { TOLERANCIAS } from '../../config/app-config';
import type { InformeParseado } from '../../models/informe';
import type { EstadisticasOperaciones } from '../../models/estadisticas';
import type { OperacionInforme } from '../../models/operacion';
import { netoDeOperacion, redondear2 } from '../estadisticas/calculadora-estadisticas';

export type EstadoComprobacion = 'coincide' | 'diferencia' | 'no_disponible';

export interface Comprobacion {
  readonly concepto: string;
  /** null si el informe no trae esa cifra (el informe «general» no tiene el bloque de detalles). */
  readonly informe: number | null;
  readonly calculado: number;
  readonly decimales: number;
  readonly estado: EstadoComprobacion;
}

function netoDeInforme(operacion: OperacionInforme): number {
  return netoDeOperacion({ ...operacion, cierre: operacion.cierreBroker ?? '' });
}

function sumarNetos(operaciones: readonly OperacionInforme[]): number {
  return redondear2(operaciones.reduce((suma, operacion) => suma + netoDeInforme(operacion), 0));
}

/** Suma de ingresos y retiradas anteriores a la primera operación: es el balance con el que se empieza. */
export function calcularBalanceInicial(informe: InformeParseado): number {
  const aperturas = [...informe.cerradas, ...informe.abiertas].map((operacion) => operacion.aperturaBroker);
  if (aperturas.length === 0) return 0;
  const primeraApertura = aperturas.reduce((primera, hora) => (hora < primera ? hora : primera));
  const anteriores = informe.movimientos.filter((movimiento) => movimiento.horaBroker < primeraApertura);
  return redondear2(anteriores.reduce((suma, movimiento) => suma + movimiento.importe, 0));
}

function comprobar(
  concepto: string,
  informe: number | undefined,
  calculado: number,
  tolerancia: number,
  decimales = 2,
): Comprobacion {
  if (informe === undefined) {
    return { concepto, informe: null, calculado, decimales, estado: 'no_disponible' };
  }
  const coincide = Math.abs(informe - calculado) <= tolerancia + 1e-9;
  return { concepto, informe, calculado, decimales, estado: coincide ? 'coincide' : 'diferencia' };
}

export function validarTotales(
  informe: InformeParseado,
  estadisticas: EstadisticasOperaciones,
): Comprobacion[] {
  const t = informe.totales;
  const { dinero, ratio, porcentaje } = TOLERANCIAS;

  const depositos = redondear2(informe.movimientos.reduce((suma, movimiento) => suma + movimiento.importe, 0));
  const resultadoCerrado = sumarNetos(informe.cerradas);
  const flotante = sumarNetos(informe.abiertas);

  return [
    comprobar('Operaciones cerradas', t.totalOperaciones, estadisticas.totalOperaciones, 0, 0),
    comprobar('Operaciones largas', t.largas, estadisticas.largas, 0, 0),
    comprobar('Operaciones cortas', t.cortas, estadisticas.cortas, 0, 0),
    comprobar('Operaciones ganadoras', t.ganadoras, estadisticas.ganadoras, 0, 0),
    comprobar('Operaciones perdedoras', t.perdedoras, estadisticas.perdedoras, 0, 0),
    comprobar('Beneficio bruto', t.beneficioBruto, estadisticas.beneficioBruto, dinero),
    // El informe da la pérdida bruta en positivo.
    comprobar('Pérdida bruta', t.perdidaBruta, Math.abs(estadisticas.perdidaBruta), dinero),
    comprobar('Resultado neto', t.beneficioNeto, estadisticas.beneficioNeto, dinero),
    comprobar('Factor de beneficio', t.factorBeneficio, estadisticas.factorBeneficio ?? 0, ratio),
    comprobar('Pago esperado', t.pagoEsperado, estadisticas.pagoEsperado, ratio),
    comprobar('Mayor ganancia', t.mayorGanancia, estadisticas.mayorGanancia, dinero),
    comprobar('Mayor pérdida', t.mayorPerdida, estadisticas.mayorPerdida, dinero),
    comprobar('Ganancia media', t.gananciaMedia, estadisticas.gananciaMedia, ratio),
    comprobar('Pérdida media', t.perdidaMedia, estadisticas.perdidaMedia, ratio),
    comprobar('Racha máxima de ganadoras', t.rachaGanadoras, estadisticas.rachaGanadoras, 0, 0),
    comprobar('Importe de esa racha', t.rachaGanadorasImporte, estadisticas.rachaGanadorasImporte, dinero),
    comprobar('Racha máxima de perdedoras', t.rachaPerdedoras, estadisticas.rachaPerdedoras, 0, 0),
    comprobar('Importe de esa racha', t.rachaPerdedorasImporte, estadisticas.rachaPerdedorasImporte, dinero),
    comprobar('Drawdown absoluto', t.drawdownAbsoluto, estadisticas.drawdownAbsoluto, dinero),
    comprobar('Drawdown máximo', t.drawdownMaximo, estadisticas.drawdownMaximo, dinero),
    comprobar('Drawdown máximo (%)', t.drawdownMaximoPct, estadisticas.drawdownMaximoPct, porcentaje),
    comprobar('Ingresos y retiradas', t.depositos, depositos, dinero),
    comprobar('Resultado de operaciones cerradas', t.resultadoCerrado, resultadoCerrado, dinero),
    comprobar('Resultado flotante (abiertas)', t.flotante, flotante, dinero),
    comprobar('Balance', t.balance, redondear2(depositos + resultadoCerrado), dinero),
  ];
}
