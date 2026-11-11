import type { HorarioBroker } from '../core/horario';

export type Plataforma = 'mt4';

export interface MovimientoGuardado {
  /** "cuenta:ticket" */
  readonly id: string;
  readonly cuenta: string;
  readonly ticket: string;
  readonly descripcion: string;
  readonly importe: number;
  readonly horaBroker: string;
  readonly utcMs: number;
  readonly importacionId: string;
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
  readonly cuenta: string;
  readonly ticket: string;
  readonly fechaMs: number;
  readonly stopLoss: number | null;
  readonly takeProfit: number | null;
  readonly precioActual: number | null;
}

export interface RegistroImportacion {
  readonly id: string;
  readonly cuenta: string;
  readonly plataforma: Plataforma;
  readonly nombreFichero: string;
  readonly broker: string | null;
  readonly horario: HorarioBroker;
  readonly fechaMs: number;
  readonly nuevas: number;
  readonly cerradasDesdeAbierta: number;
  readonly yaExistentes: number;
  readonly abiertas: number;
  readonly validacionCorrecta: boolean;
}
