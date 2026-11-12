import type { CuentaTrading } from './cuenta';
/** Periodo de tiempo por el que se filtran las operaciones (siempre en UTC). */
export type Periodo =
  | { readonly tipo: 'total' }
  | { readonly tipo: 'anio'; readonly anio: number }
  | { readonly tipo: 'trimestre'; readonly anio: number; readonly trimestre: 1 | 2 | 3 | 4 }
  | { readonly tipo: 'mes'; readonly anio: number; readonly mes: number }
  /** Fechas "YYYY-MM-DD", ambas incluidas. */
  | { readonly tipo: 'rango'; readonly desde: string; readonly hasta: string };

/** Cómo terminó la operación (según su resultado, ver clasificacion-cierre). */
export type ClasificacionCierre = 'tp' | 'sl' | 'break_even' | 'manual';

export interface Filtro {
  readonly periodo: Periodo;
  /** null = todos los activos. */
  readonly activo: string | null;
  /** null = todas las cuentas (las pantallas siempre eligen una: no se mezclan estrategias). */
  readonly cuenta: CuentaTrading | null;
  /** null = todas. */
  readonly cierre: ClasificacionCierre | null;
}

export const FILTRO_INICIAL: Filtro = { periodo: { tipo: 'total' }, activo: null, cuenta: null, cierre: null };
