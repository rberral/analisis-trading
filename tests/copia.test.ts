import { describe, expect, it } from 'vitest';
import { COPIA_SEGURIDAD } from '../src/config/app-config';
import { ErrorDeUsuario } from '../src/core/errores';
import { NOMBRES_TABLAS, type AlmacenDatos, type Fila, type NombreTabla, type TablasCopia } from '../src/services/copia/puertos';
import { ServicioCopia } from '../src/services/copia/servicio-copia';

class AlmacenEnMemoria implements AlmacenDatos {
  tablas: TablasCopia = Object.fromEntries(NOMBRES_TABLAS.map((n) => [n, [] as Fila[]])) as TablasCopia;

  async leerTablas() {
    return structuredClone(this.tablas);
  }
  async guardarTablas(nuevas: TablasCopia) {
    for (const nombre of NOMBRES_TABLAS) {
      const porId = new Map(this.tablas[nombre].map((f) => [f.id, f]));
      for (const fila of nuevas[nombre]) porId.set(fila.id, fila);
      this.tablas[nombre] = [...porId.values()];
    }
  }
  async eliminar(tabla: NombreTabla, ids: readonly string[]) {
    this.tablas[tabla] = this.tablas[tabla].filter((f) => !ids.includes(f.id));
  }
  async vaciarTodo() {
    for (const nombre of NOMBRES_TABLAS) this.tablas[nombre] = [];
  }
}

const op = (id: string, broker: string, cuenta: string, cierreUtc: number | null = 5): Fila => ({ id, broker, cuenta, cierreUtc });

function crear() {
  const almacen = new AlmacenEnMemoria();
  almacen.tablas.operaciones = [op('A:1:1', 'A', '1'), op('A:1:2', 'A', '1'), op('B:2:1', 'B', '2')];
  almacen.tablas.movimientos = [{ id: 'A:1:m', broker: 'A', cuenta: '1' }, { id: 'B:2:m', broker: 'B', cuenta: '2' }];
  almacen.tablas.importaciones = [{ id: 'i1', broker: 'A', cuenta: '1' }, { id: 'i2', broker: 'B', cuenta: '2' }];
  almacen.tablas.ventanasVelas = [{ id: 'v1', operacionId: 'A:1:1' }, { id: 'v2', operacionId: 'B:2:1' }];
  almacen.tablas.cargasVelas = [{ id: 'c1' }];
  return { almacen, servicio: new ServicioCopia(almacen, COPIA_SEGURIDAD) };
}

describe('ServicioCopia', () => {
  it('resume los datos por cuenta', async () => {
    const r = await crear().servicio.resumen();
    expect(r.operaciones).toBe(3);
    expect(r.cuentas.map((c) => c.operaciones)).toEqual([2, 1]);
  });

  it('exporta y reimporta todo sin pérdidas', async () => {
    const origen = crear();
    const copia = await origen.servicio.exportar(1000);
    const destino = new AlmacenEnMemoria();
    const resultado = await new ServicioCopia(destino, COPIA_SEGURIDAD).importar(JSON.stringify(copia));
    expect(destino.tablas).toEqual(origen.almacen.tablas);
    expect(resultado.operacionesNuevas).toBe(3);
  });

  it('exportar sin velas deja fuera las ventanas y los ficheros cargados', async () => {
    const { servicio } = crear();
    const completa = await servicio.exportar(1);
    const ligera = await servicio.exportar(1, false);
    expect(completa.tablas.ventanasVelas).toHaveLength(2);
    expect(ligera.tablas.ventanasVelas).toHaveLength(0);
    expect(ligera.tablas.cargasVelas).toHaveLength(0);
    expect(ligera.tablas.operaciones).toHaveLength(3);
  });

  it('fusiona: no borra lo existente y no reabre una operación ya cerrada', async () => {
    const { almacen, servicio } = crear();
    const copia = await servicio.exportar(1);
    const abiertaAntigua = { ...copia, tablas: { ...copia.tablas, operaciones: [op('A:1:1', 'A', '1', null), op('A:1:3', 'A', '1')] } };
    const r = await servicio.importar(JSON.stringify(abiertaAntigua));
    expect(r.operacionesNuevas).toBe(1);
    expect(almacen.tablas.operaciones).toHaveLength(4);
    expect(almacen.tablas.operaciones.find((o) => o.id === 'A:1:1')?.['cierreUtc']).toBe(5);
  });

  it('rechaza ficheros que no son una copia válida', async () => {
    const { servicio } = crear();
    const bueno = JSON.parse(JSON.stringify(await servicio.exportar(1)));
    const casos = [
      'esto no es json',
      JSON.stringify({ formato: 'otra-cosa' }),
      JSON.stringify({ ...bueno, version: COPIA_SEGURIDAD.version + 1 }),
      JSON.stringify({ ...bueno, tablas: { ...bueno.tablas, operaciones: 'x' } }),
      JSON.stringify({ ...bueno, tablas: { ...bueno.tablas, operaciones: [{ id: 'z' }] } }),
    ];
    for (const texto of casos) await expect(servicio.importar(texto)).rejects.toThrow(ErrorDeUsuario);
  });

  it('borrar una cuenta conserva las demás y los ficheros de velas', async () => {
    const { almacen, servicio } = crear();
    await servicio.borrar({ tipo: 'cuenta', cuenta: { broker: 'A', cuenta: '1' } });
    expect(almacen.tablas.operaciones.map((o) => o.id)).toEqual(['B:2:1']);
    expect(almacen.tablas.movimientos.map((o) => o.id)).toEqual(['B:2:m']);
    expect(almacen.tablas.importaciones.map((o) => o.id)).toEqual(['i2']);
    expect(almacen.tablas.ventanasVelas.map((o) => o.id)).toEqual(['v2']);
    expect(almacen.tablas.cargasVelas).toHaveLength(1);
  });

  it('borrar solo las velas deja operaciones y brokers', async () => {
    const { almacen, servicio } = crear();
    await servicio.borrar({ tipo: 'velas' });
    expect(almacen.tablas.ventanasVelas).toHaveLength(0);
    expect(almacen.tablas.cargasVelas).toHaveLength(0);
    expect(almacen.tablas.operaciones).toHaveLength(3);
  });

  it('con solo velas guardadas sigue habiendo datos que borrar', async () => {
    const { almacen, servicio } = crear();
    await servicio.borrar({ tipo: 'cuenta', cuenta: { broker: 'A', cuenta: '1' } });
    await servicio.borrar({ tipo: 'cuenta', cuenta: { broker: 'B', cuenta: '2' } });
    const r = await servicio.resumen();
    expect(r.operaciones).toBe(0);
    expect(r.cargasVelas).toBe(1);
    expect(r.hayDatos).toBe(true);
    await servicio.borrar({ tipo: 'todo' });
    expect((await servicio.resumen()).hayDatos).toBe(false);
    expect(almacen.tablas.cargasVelas).toHaveLength(0);
  });

  it('borrar todo vacía las tablas', async () => {
    const { almacen, servicio } = crear();
    await servicio.borrar({ tipo: 'todo' });
    expect(NOMBRES_TABLAS.every((n) => almacen.tablas[n].length === 0)).toBe(true);
  });
});
