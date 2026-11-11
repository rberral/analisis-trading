import type Dexie from 'dexie';
import type { MovimientoGuardado } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';
import type { DatosGuardados, LectorDatos } from '../../services/consultas/puertos';

/** Lee de la base de datos del navegador lo necesario para las pantallas. */
export class LectorDexie implements LectorDatos {
  constructor(private readonly baseDeDatos: Dexie) {}

  async leerTodo(): Promise<DatosGuardados> {
    const [operaciones, movimientos] = await Promise.all([
      this.baseDeDatos.table<OperacionGuardada, string>('operaciones').toArray(),
      this.baseDeDatos.table<MovimientoGuardado, string>('movimientos').toArray(),
    ]);
    return { operaciones, movimientos };
  }
}
