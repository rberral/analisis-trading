/**
 * Configuración de la base de datos del navegador (IndexedDB).
 *
 * Cada cambio en las tablas se añade como una versión NUEVA en la lista; las
 * versiones antiguas no se modifican nunca. Así los datos que ya están guardados
 * en el navegador del usuario se migran solos al abrir la aplicación.
 */

export interface VersionEsquema {
  readonly version: number;
  /** Tablas de esa versión: nombre de la tabla y su clave primaria e índices. */
  readonly tablas: Readonly<Record<string, string>>;
}

export const BASE_DE_DATOS_CONFIG = {
  nombre: 'diario-trading',
  versiones: [
    {
      version: 1,
      tablas: {
        // Valores sueltos de la aplicación (preferencias, versión de los datos…).
        ajustes: 'clave',
      },
    },
  ] as readonly VersionEsquema[],
} as const;
