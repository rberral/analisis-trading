import type { MovimientoGuardado, RegistroImportacion } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';

export interface DatosGuardados {
  readonly operaciones: readonly OperacionGuardada[];
  readonly movimientos: readonly MovimientoGuardado[];
  /** Registro de importaciones: de ahí salen el resumen de cuenta y el apalancamiento indicados. */
  readonly importaciones?: readonly RegistroImportacion[];
}

/** Lee todo lo guardado. Con el volumen de un diario personal (miles de filas) basta con cargarlo entero. */
export interface LectorDatos {
  leerTodo(): Promise<DatosGuardados>;
}
