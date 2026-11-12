import type Dexie from 'dexie';
import { NOMBRES_TABLAS, type AlmacenDatos, type Fila, type NombreTabla, type TablasCopia } from '../../services/copia/puertos';

/** Lee, escribe y borra tablas enteras de la base de datos del navegador (para copia de seguridad y borrado). */
export class AlmacenDexie implements AlmacenDatos {
  constructor(private readonly baseDeDatos: Dexie) {}

  private tabla(nombre: NombreTabla) {
    return this.baseDeDatos.table<Fila, string>(nombre);
  }

  async leerTablas(): Promise<TablasCopia> {
    const lecturas = await Promise.all(NOMBRES_TABLAS.map((nombre) => this.tabla(nombre).toArray()));
    return Object.fromEntries(NOMBRES_TABLAS.map((nombre, i) => [nombre, lecturas[i]])) as TablasCopia;
  }

  async guardarTablas(tablas: TablasCopia): Promise<void> {
    const objetivo = NOMBRES_TABLAS.map((nombre) => this.tabla(nombre));
    await this.baseDeDatos.transaction('rw', objetivo, async () => {
      for (const nombre of NOMBRES_TABLAS) await this.tabla(nombre).bulkPut(tablas[nombre]);
    });
  }

  async eliminar(tabla: NombreTabla, ids: readonly string[]): Promise<void> {
    await this.tabla(tabla).bulkDelete([...ids]);
  }

  async vaciarTodo(): Promise<void> {
    const objetivo = NOMBRES_TABLAS.map((nombre) => this.tabla(nombre));
    await this.baseDeDatos.transaction('rw', objetivo, async () => {
      for (const t of objetivo) await t.clear();
    });
  }
}
