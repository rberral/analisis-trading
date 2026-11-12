import { describe, expect, it } from 'vitest';
import { ParserMt4 } from '../src/adapters/statement-parsers/mt4-html-parser';
import { ErrorDeUsuario } from '../src/core/errores';
import type { OperacionGuardada } from '../src/models/operacion';
import { ServicioImportacion, type OpcionesImportacion } from '../src/services/importacion/importacion-service';
import type { DatosAGuardar, RepositorioOperaciones } from '../src/services/importacion/puertos';
import { INFORME_MT4_EJEMPLO } from './fixtures/informe-mt4';

/** Repositorio en memoria: imita el comportamiento del real sin base de datos. */
class RepositorioEnMemoria implements RepositorioOperaciones {
  readonly operaciones = new Map<string, OperacionGuardada>();
  importaciones = 0;
  readonly monedas = new Map<string, string>();

  async monedaDeCuenta(broker: string, cuenta: string) {
    return this.monedas.get(`${broker}:${cuenta}`) ?? null;
  }

  async estadoDeOperaciones(ids: readonly string[]) {
    const estados = new Map<string, 'abierta' | 'cerrada'>();
    for (const id of ids) {
      const guardada = this.operaciones.get(id);
      if (guardada) estados.set(id, guardada.cierreUtc === null ? 'abierta' : 'cerrada');
    }
    return estados;
  }

  async guardarImportacion(datos: DatosAGuardar) {
    for (const operacion of datos.operaciones) this.operaciones.set(operacion.id, operacion);
    this.importaciones += 1;
    this.monedas.set(`${datos.importacion.broker}:${datos.importacion.cuenta}`, datos.importacion.moneda);
  }
}

const OPCIONES: OpcionesImportacion = {
  plataforma: 'mt4',
  nombreFichero: 'informe.htm',
  broker: 'IC Markets',
  cuenta: '',
  moneda: '',
  horario: { tipo: 'zona', zona: 'Europe/Athens' },
};

/** Mismo informe, pero con la operación 1007 ya cerrada (pasa de "Open Trades" a "Closed Transactions"). */
function informeConLaAbiertaCerrada(): string {
  const filaCerrada =
    '<tr align=right><td title="Prueba">1007</td><td class=msdate nowrap>2026.01.09 10:00:00</td><td>buy</td><td class=mspt>1.00</td><td>eurusd</td><td>1.10000</td><td>1.09000</td><td>1.12000</td><td class=msdate nowrap>2026.01.10 10:00:00</td><td>1.10150</td><td class=mspt>-0.50</td><td class=mspt>0.00</td><td class=mspt>-0.20</td><td class=mspt>15.00</td></tr>';
  return INFORME_MT4_EJEMPLO.replace(/<tr align=right><td title="Prueba">1007<\/td>.*?<\/tr>/s, '').replace(
    '<tr align=right><td title="Prueba[tp]">1001',
    filaCerrada + '<tr align=right><td title="Prueba[tp]">1001',
  );
}

function crear() {
  const repositorio = new RepositorioEnMemoria();
  const servicio = new ServicioImportacion({ mt4: new ParserMt4() }, repositorio);
  return { repositorio, servicio };
}

describe('ServicioImportacion', () => {
  it('importa un informe y todas las comprobaciones coinciden', async () => {
    const { servicio, repositorio } = crear();
    const r = await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES);
    expect(r.nuevas).toBe(5); // 4 cerradas + 1 abierta
    expect(r.abiertas).toBe(1);
    expect(r.movimientos).toBe(2);
    expect(r.comprobaciones.filter((c) => c.estado === 'diferencia')).toEqual([]);
    expect(repositorio.operaciones.get('IC Markets:1000001:1001')?.cierreUtc).not.toBeNull();
  });

  it('al repetir la importación no duplica las cerradas', async () => {
    const { servicio } = crear();
    await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES);
    const segunda = await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES);
    expect(segunda.nuevas).toBe(0);
    expect(segunda.yaExistentes).toBe(5);
  });

  it('detecta una operación abierta que en la siguiente importación ya está cerrada', async () => {
    const { servicio, repositorio } = crear();
    await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES);
    expect(repositorio.operaciones.get('IC Markets:1000001:1007')?.cierreUtc).toBeNull();

    const segunda = await servicio.importar(informeConLaAbiertaCerrada(), OPCIONES);
    expect(segunda.cerradasDesdeAbierta).toBe(1);
    expect(segunda.nuevas).toBe(0);
    expect(repositorio.operaciones.get('IC Markets:1000001:1007')?.cierreUtc).not.toBeNull();
  });

  it('exige el broker', async () => {
    const { servicio, repositorio } = crear();
    await expect(servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, broker: '  ' })).rejects.toThrow(ErrorDeUsuario);
    expect(repositorio.importaciones).toBe(0);
  });

  it('usa el nombre de cuenta indicado o, si falta, el número del informe', async () => {
    const { servicio, repositorio } = crear();
    expect((await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES)).cuenta).toBe('1000001');
    const r = await servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, cuenta: 'Scalping' });
    expect(r.cuenta).toBe('Scalping');
    expect(r.nuevas).toBe(5); // otra cuenta: no se confunde con la anterior
    expect(repositorio.operaciones.get('IC Markets:Scalping:1001')?.cuenta).toBe('Scalping');
  });

  it('guarda la moneda del informe (o la indicada) y no deja mezclar monedas en una cuenta', async () => {
    const { servicio, repositorio } = crear();
    const r = await servicio.importar(INFORME_MT4_EJEMPLO, OPCIONES);
    expect(r.moneda).toBe('USD');
    expect(repositorio.operaciones.get('IC Markets:1000001:1001')?.moneda).toBe('USD');
    await expect(servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, moneda: 'eur' })).rejects.toThrow(ErrorDeUsuario);
    await expect(servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, cuenta: 'Otra', moneda: 'EU' })).rejects.toThrow(ErrorDeUsuario);
    expect((await servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, cuenta: 'Otra', moneda: 'eur' })).moneda).toBe('EUR');
  });

  it('rechaza un horario inválido antes de leer nada', async () => {
    const { servicio, repositorio } = crear();
    await expect(
      servicio.importar(INFORME_MT4_EJEMPLO, { ...OPCIONES, horario: { tipo: 'zona', zona: 'Marte/Olympus' } }),
    ).rejects.toThrow(ErrorDeUsuario);
    expect(repositorio.importaciones).toBe(0);
  });
});
