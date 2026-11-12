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
    // Datos guardados antes de separar por broker: se agrupan como «Sin asignar» para que no fallen las pantallas.
    const conBroker = <T extends { broker?: string }>(fila: T): T & { broker: string } => ({ ...fila, broker: fila.broker ?? 'Sin asignar' });
    return { operaciones: operaciones.map(conBroker), movimientos: movimientos.map(conBroker) };
  }
}
