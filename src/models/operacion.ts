export type TipoOperacion = 'compra' | 'venta';
export type CierrePor = 'tp' | 'sl' | 'manual';

/** Fecha y hora del servidor del broker, sin zona horaria: "2026-10-15T17:55:00". */
export type HoraBroker = string;

/** Una operación tal como aparece en el informe de la plataforma. */
export interface OperacionInforme {
  readonly ticket: string;
  readonly tipo: TipoOperacion;
  readonly lotes: number;
  /** En mayúsculas: EURUSD. */
  readonly activo: string;
  readonly precioEntrada: number;
  /** null si la operación no tiene stop loss. */
  readonly stopLoss: number | null;
  readonly takeProfit: number | null;
  readonly aperturaBroker: HoraBroker;
  /** null si la operación sigue abierta. */
  readonly cierreBroker: HoraBroker | null;
  /** Solo en operaciones cerradas. */
  readonly precioCierre: number | null;
  /** Solo en operaciones abiertas: el precio de mercado en el momento del informe. */
  readonly precioActual: number | null;
  readonly comision: number;
  readonly impuestos: number;
  readonly swap: number;
  readonly beneficio: number;
  readonly comentario: string;
  /** Cómo se cerró; null si sigue abierta. */
  readonly cierrePor: CierrePor | null;
}

/** Ingreso, retirada o dividendo: aparece en el informe, pero no es una operación. */
export interface MovimientoInforme {
  readonly ticket: string;
  readonly horaBroker: HoraBroker;
  readonly descripcion: string;
  readonly importe: number;
}

/** Operación guardada en la base de datos del navegador. */
export interface OperacionGuardada extends OperacionInforme {
  /** "broker:cuenta:ticket": identifica la operación aunque se importe dos veces. */
  readonly id: string;
  readonly broker: string;
  readonly cuenta: string;
  /** Moneda de la cuenta (USD, EUR…): en ella están todos los importes. Vacía en datos anteriores. */
  readonly moneda: string;
  readonly aperturaUtc: number;
  /** null si sigue abierta. */
  readonly cierreUtc: number | null;
  readonly importacionId: string;
}
