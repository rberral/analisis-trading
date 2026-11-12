import { describe, expect, it } from 'vitest';
import { ErrorDeUsuario } from '../src/core/errores';
import { convertir, leerTasa, ServicioCambio, type ProveedorCambio } from '../src/services/cambio/servicio-cambio';

class AlmacenEnMemoria {
  private readonly datos = new Map<string, string>();
  leer(clave: string) {
    return this.datos.get(clave) ?? null;
  }
  escribir(clave: string, valor: string) {
    this.datos.set(clave, valor);
  }
}

const CONFIG = { monedaDestino: 'EUR', prefijoClave: 'cambio-' };
const proveedor: ProveedorCambio = { obtenerTasa: async () => ({ tasa: 0.86, fecha: '2026-11-12' }) };
const proveedorCaido: ProveedorCambio = { obtenerTasa: async () => { throw new ErrorDeUsuario('sin conexión'); } };

describe('leerTasa', () => {
  it('acepta coma y punto decimal', () => {
    expect(leerTasa('0,92')).toBe(0.92);
    expect(leerTasa(' 0.92 ')).toBe(0.92);
  });
  it('rechaza vacío, cero, negativos y texto', () => {
    for (const texto of ['', '0', '-1', 'abc']) expect(leerTasa(texto)).toBeNull();
  });
});

describe('convertir', () => {
  it('multiplica por el cambio', () => {
    expect(convertir(100, 0.86)).toBeCloseTo(86, 6);
  });
});

describe('ServicioCambio', () => {
  it('no hay cambio hasta que se guarda uno', () => {
    expect(new ServicioCambio(new AlmacenEnMemoria(), proveedor, CONFIG).obtener('USD')).toBeNull();
  });

  it('guarda el cambio escrito a mano y lo recuerda por moneda', () => {
    const servicio = new ServicioCambio(new AlmacenEnMemoria(), proveedor, CONFIG);
    servicio.fijarManual('USD', '0,9');
    expect(servicio.obtener('USD')).toEqual({ moneda: 'USD', tasa: 0.9, fecha: null, origen: 'manual' });
    expect(servicio.obtener('GBP')).toBeNull();
  });

  it('rechaza un cambio escrito no válido', () => {
    expect(() => new ServicioCambio(new AlmacenEnMemoria(), proveedor, CONFIG).fijarManual('USD', 'x')).toThrow(ErrorDeUsuario);
  });

  it('actualiza desde el proveedor y guarda la fecha', async () => {
    const servicio = new ServicioCambio(new AlmacenEnMemoria(), proveedor, CONFIG);
    expect(await servicio.actualizar('USD')).toEqual({ moneda: 'USD', tasa: 0.86, fecha: '2026-11-12', origen: 'automatico' });
    expect(servicio.obtener('USD')?.tasa).toBe(0.86);
  });

  it('si el proveedor falla mantiene el cambio anterior', async () => {
    const servicio = new ServicioCambio(new AlmacenEnMemoria(), proveedorCaido, CONFIG);
    servicio.fijarManual('USD', '0,9');
    await expect(servicio.actualizar('USD')).rejects.toThrow(ErrorDeUsuario);
    expect(servicio.obtener('USD')?.tasa).toBe(0.9);
  });

  it('ignora un valor guardado dañado', () => {
    const almacen = new AlmacenEnMemoria();
    almacen.escribir('cambio-USD', '{"tasa":"x"}');
    expect(new ServicioCambio(almacen, proveedor, CONFIG).obtener('USD')).toBeNull();
  });
});
