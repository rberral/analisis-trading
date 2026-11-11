import type Dexie from 'dexie';
import type { InstantaneaAbierta, MovimientoGuardado, RegistroImportacion } from '../../models/importacion';
import type { OperacionGuardada } from '../../models/operacion';
import type { DatosAGuardar, RepositorioOperaciones } from '../../services/importacion/puertos';

/** Guarda operaciones, movimientos e importaciones en la base de datos del navegador. */
export class RepositorioOperacionesDexie implements RepositorioOperaciones {
  constructor(private readonly baseDeDatos: Dexie) {}

  async estadoDeOperaciones(ids: readonly string[]): Promise<ReadonlyMap<string, 'abierta' | 'cerrada'>> {
    const existentes = await this.baseDeDatos.table<OperacionGuardada, string>('operaciones').bulkGet([...ids]);
    const estados = new Map<string, 'abierta' | 'cerrada'>();
    for (const operacion of existentes) {
      if (operacion) estados.set(operacion.id, operacion.cierreUtc === null ? 'abierta' : 'cerrada');
    }
    return estados;
  }

  async guardarImportacion(datos: DatosAGuardar): Promise<void> {
    const db = this.baseDeDatos;
    const operaciones = db.table<OperacionGuardada, string>('operaciones');
    const movimientos = db.table<MovimientoGuardado, string>('movimientos');
    const instantaneas = db.table<InstantaneaAbierta, string>('instantaneasAbiertas');
    const importaciones = db.table<RegistroImportacion, string>('importaciones');

    // Una sola transacción: si algo falla, no queda guardada una importación a medias.
    await db.transaction('rw', [operaciones, movimientos, instantaneas, importaciones], async () => {
      await operaciones.bulkPut([...datos.operaciones]);
      await movimientos.bulkPut([...datos.movimientos]);
      await instantaneas.bulkPut([...datos.instantaneas]);
      await importaciones.put(datos.importacion);
    });
  }
}
