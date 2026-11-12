import type { MovimientoInforme, OperacionInforme } from './operacion';

/**
 * Cifras que el propio informe trae calculadas (resumen y bloque de detalles).
 * Todas son opcionales: el informe «general» no incluye el bloque de detalles.
 * Sirven para comprobar que la importación no ha perdido ni duplicado nada.
 */
export interface TotalesInforme {
  // Resumen
  depositos?: number;
  resultadoCerrado?: number;
  flotante?: number;
  balance?: number;
  // Detalles
  beneficioBruto?: number;
  perdidaBruta?: number;
  beneficioNeto?: number;
  factorBeneficio?: number;
  pagoEsperado?: number;
  drawdownAbsoluto?: number;
  drawdownMaximo?: number;
  drawdownMaximoPct?: number;
  totalOperaciones?: number;
  largas?: number;
  cortas?: number;
  ganadoras?: number;
  perdedoras?: number;
  mayorGanancia?: number;
  mayorPerdida?: number;
  gananciaMedia?: number;
  perdidaMedia?: number;
  rachaGanadoras?: number;
  rachaGanadorasImporte?: number;
  rachaPerdedoras?: number;
  rachaPerdedorasImporte?: number;
}

export interface InformeParseado {
  readonly cuenta: string;
  readonly nombre: string;
  readonly moneda: string;
  readonly cerradas: readonly OperacionInforme[];
  readonly abiertas: readonly OperacionInforme[];
  readonly movimientos: readonly MovimientoInforme[];
  readonly totales: TotalesInforme;
  /** true si el informe incluye el bloque de detalles (el «detallado»). */
  readonly tieneBloqueDetalle: boolean;
  /** Observaciones del lector (por ejemplo, una posición cuya suma no coincide con su total). */
  readonly avisos?: readonly string[];
}
