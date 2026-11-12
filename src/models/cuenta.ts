/**
 * Una cuenta de trading = broker + cuenta. Cada combinación puede usar una estrategia distinta,
 * así que todo el análisis se hace por separado para cada una.
 */
export interface CuentaTrading {
  readonly broker: string;
  readonly cuenta: string;
}

/** Texto único de una cuenta, para usarla como clave o como valor de un selector. */
export const claveCuenta = (c: CuentaTrading): string => `${c.broker}\u0000${c.cuenta}`;

export const textoCuenta = (c: CuentaTrading): string => `${c.broker} · ${c.cuenta}`;

export const mismaCuenta = (a: CuentaTrading, b: CuentaTrading): boolean => a.broker === b.broker && a.cuenta === b.cuenta;
