/** Estadísticas de un conjunto de operaciones cerradas. Los importes están en la moneda de la cuenta. */
export interface EstadisticasOperaciones {
  readonly totalOperaciones: number;
  readonly largas: number;
  readonly cortas: number;
  readonly ganadoras: number;
  readonly perdedoras: number;
  readonly beneficioBruto: number;
  /** Suma de las pérdidas: es un número negativo. */
  readonly perdidaBruta: number;
  readonly beneficioNeto: number;
  /** Beneficio bruto entre pérdida bruta; null si no hay pérdidas. */
  readonly factorBeneficio: number | null;
  readonly pagoEsperado: number;
  readonly mayorGanancia: number;
  readonly mayorPerdida: number;
  readonly gananciaMedia: number;
  readonly perdidaMedia: number;
  readonly rachaGanadoras: number;
  readonly rachaGanadorasImporte: number;
  readonly rachaPerdedoras: number;
  readonly rachaPerdedorasImporte: number;
  /** Cuánto llegó a estar el balance por debajo del balance inicial. */
  readonly drawdownAbsoluto: number;
  /** Mayor caída desde un máximo del balance. */
  readonly drawdownMaximo: number;
  readonly drawdownMaximoPct: number;
}
