import type Dexie from 'dexie';
import type { HorarioBroker } from '../../core/horario';
import type { RegistroImportacion } from '../../models/importacion';
import type { RegistroCargaVelas } from '../../models/velas';
import type { LectorHorarios } from '../../services/consultas/puertos-horarios';

export class LectorHorariosDexie implements LectorHorarios {
  constructor(private readonly baseDeDatos: Dexie) {}

  async leerHorarios(): Promise<ReadonlyMap<string, HorarioBroker>> {
    const [importaciones, cargas] = await Promise.all([
      this.baseDeDatos.table<RegistroImportacion, string>('importaciones').toArray(),
      this.baseDeDatos.table<RegistroCargaVelas, string>('cargasVelas').toArray(),
    ]);
    const horarios = new Map<string, HorarioBroker>();
    for (const registro of [...importaciones, ...cargas]) horarios.set(registro.id, registro.horario);
    return horarios;
  }
}
