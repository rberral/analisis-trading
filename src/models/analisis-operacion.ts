/** Cuánto se movió el precio a favor y en contra mientras la operación estuvo abierta. */
export interface Recorrido {
  /** Máximo recorrido a favor (en precio). */
  readonly mfe: number;
  /** Máximo recorrido en contra (en precio). */
  readonly mae: number;
  /** Qué parte del camino hasta el take profit llegó a recorrer (%), si tiene TP. */
  readonly mfePorcentajeTp: number | null;
  /** Qué parte del camino hasta el stop loss llegó a recorrer (%), si tiene SL. */
  readonly maePorcentajeSl: number | null;
  /** Velas completas usadas. Con 0 solo se conocen los precios de entrada y salida: el recorrido real puede ser mayor. */
  readonly velasUsadas: number;
}

/** Qué hizo el precio justo después de cerrar a mano una operación con take profit. */
export type SalidaPosterior = 'tp_alcanzado' | 'sl_alcanzado' | 'ninguno' | 'no_aplica';

export interface EvaluacionSalida {
  readonly resultado: SalidaPosterior;
  /** Velas posteriores al cierre que se han podido mirar. */
  readonly velasMiradas: number;
}
