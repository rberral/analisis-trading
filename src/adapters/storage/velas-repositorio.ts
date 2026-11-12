import type Dexie from 'dexie';
import type { RegistroCargaVelas, VentanaVelas } from '../../models/velas';
import type { RepositorioVelas } from '../../services/velas/puertos';

/** Guarda en el navegador las ventanas de velas de cada operación y el registro de las cargas. */
export class RepositorioVelasDexie implements RepositorioVelas {
  constructor(private readonly baseDeDatos: Dexie) {}

  async guardarCarga(registro: RegistroCargaVelas, ventanas: readonly VentanaVelas[]): Promise<void> {
    const db = this.baseDeDatos;
    const tablaVentanas = db.table<VentanaVelas, string>('ventanasVelas');
    const tablaCargas = db.table<RegistroCargaVelas, string>('cargasVelas');
    // bulkPut reemplaza las ventanas de la misma operación y temporalidad (mismo id).
    await db.transaction('rw', [tablaVentanas, tablaCargas], async () => {
      await tablaVentanas.bulkPut([...ventanas]);
      await tablaCargas.put(registro);
    });
  }

  async listarCargas(): Promise<RegistroCargaVelas[]> {
    const cargas = await this.baseDeDatos.table<RegistroCargaVelas, string>('cargasVelas').toArray();
    return cargas.sort((a, b) => b.fechaMs - a.fechaMs);
  }
}
