import type { HorarioBroker } from '../core/horario';
import type { ClaseMovimiento } from './operacion';

export type Plataforma = 'mt4' | 'quantfury';

export interface MovimientoGuardado {
  /** "broker:cuenta:ticket" */
  readonly id: string;
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
  readonly ticket: string;
  readonly descripcion: string;
  readonly importe: number;
  readonly horaBroker: string;
  readonly utcMs: number;
  readonly importacionId: string;
  readonly clase?: ClaseMovimiento;
  /** Importe y moneda originales cuando se ha convertido a la moneda de la cuenta. */
  readonly importeOrigen?: number;
  readonly monedaOrigen?: string;
}

/** Cifras de la cuenta que da el broker en una fecha: sirven para comprobar el saldo calculado y para mostrarlo. */
export interface ResumenCuenta {
  readonly fechaUtcMs: number;
  /** Saldo de la cuenta de trading que da el informe: incluye las ganancias no realizadas. */
  readonly patrimonio: number;
  /** Ganancias o pérdidas de las posiciones abiertas en esa fecha. Solo informativo. */
  readonly noRealizadas: number;
}

/**
 * Foto del SL y TP de una operación abierta en el momento de importar.
 * Comparando fotos de importaciones distintas se pueden detectar movimientos
 * del stop loss, que el informe por sí solo no permite ver.
 */
export interface InstantaneaAbierta {
  /** "importacionId:ticket" */
  readonly id: string;
  readonly importacionId: string;
  readonly broker: string;
  readonly cuenta: string;
  readonly ticket: string;
  readonly fechaMs: number;
  readonly stopLoss: number | null;
  readonly takeProfit: number | null;
  readonly precioActual: number | null;
}

export interface RegistroImportacion {
  readonly id: string;
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
  readonly plataforma: Plataforma;
  readonly nombreFichero: string;
  readonly horario: HorarioBroker;
  readonly fechaMs: number;
  readonly nuevas: number;
  readonly cerradasDesdeAbierta: number;
  readonly yaExistentes: number;
  readonly abiertas: number;
  readonly validacionCorrecta: boolean;
  /** Apalancamiento que indica el usuario al importar. Solo informativo: no se usa en ningún cálculo. */
  readonly apalancamiento?: number | null;
  readonly resumenCuenta?: ResumenCuenta;
}
