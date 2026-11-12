import type Dexie from 'dexie';
import type { VentanaVelas } from '../../models/velas';
import type { LectorVentanas } from '../../services/consultas/puertos-ventanas';

export class LectorVentanasDexie implements LectorVentanas {
  constructor(private readonly baseDeDatos: Dexie) {}

  private tabla() {
    return this.baseDeDatos.table<VentanaVelas, string>('ventanasVelas');
  }

  leerVentanas(): Promise<VentanaVelas[]> {
    return this.tabla().toArray();
  }

  leerVentanasDe(operacionId: string): Promise<VentanaVelas[]> {
    return this.tabla().where('operacionId').equals(operacionId).toArray();
  }
}
