import type { MovimientoGuardado } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';

export interface DatosGuardados {
  readonly operaciones: readonly OperacionGuardada[];
  readonly movimientos: readonly MovimientoGuardado[];
}

/** Lee todo lo guardado. Con el volumen de un diario personal (miles de filas) basta con cargarlo entero. */
export interface LectorDatos {
  leerTodo(): Promise<DatosGuardados>;
}
