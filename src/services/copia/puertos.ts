/** Lo que el servicio de copia necesita del almacenamiento (la implementación está en adapters/storage). */
export const NOMBRES_TABLAS = ['operaciones', 'movimientos', 'importaciones', 'instantaneasAbiertas', 'ventanasVelas', 'cargasVelas'] as const;
export type NombreTabla = (typeof NOMBRES_TABLAS)[number];

export type Fila = { readonly id: string } & Readonly<Record<string, unknown>>;
export type TablasCopia = Record<NombreTabla, Fila[]>;

export interface AlmacenDatos {
  leerTablas(): Promise<TablasCopia>;
  /** Guarda las filas; si una ya existe (mismo id) la reemplaza. Todo o nada. */
  guardarTablas(tablas: TablasCopia): Promise<void>;
  eliminar(tabla: NombreTabla, ids: readonly string[]): Promise<void>;
  vaciarTodo(): Promise<void>;
}
