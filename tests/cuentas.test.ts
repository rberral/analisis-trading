import { describe, expect, it } from 'vitest';
import { FILTRO_INICIAL } from '../src/models/filtro';
import { analizarPeriodo, opcionesDelFiltro } from '../src/services/consultas/analisis-periodo';
import { asegurarCuenta, listarCuentas } from '../src/services/consultas/cuentas';
import { crearOperacion } from './fixtures/operaciones';

const a = crearOperacion('1', { broker: 'A', cuenta: '1', id: 'A:1:1', beneficio: 100 });
const b = crearOperacion('1', { broker: 'B', cuenta: '1', id: 'B:1:1', beneficio: -50, activo: 'XAUUSD' });
const datos = { operaciones: [b, a], movimientos: [] };

describe('listarCuentas', () => {
  it('lista cada broker + cuenta una vez, ordenadas', () => {
    expect(listarCuentas(datos)).toEqual([{ broker: 'A', cuenta: '1' }, { broker: 'B', cuenta: '1' }]);
  });
});

describe('asegurarCuenta', () => {
  const cuentas = listarCuentas(datos);

  it('elige la primera si no hay cuenta o ya no existe', () => {
    expect(asegurarCuenta(FILTRO_INICIAL, cuentas).cuenta).toEqual({ broker: 'A', cuenta: '1' });
    expect(asegurarCuenta({ ...FILTRO_INICIAL, cuenta: { broker: 'Z', cuenta: '9' } }, cuentas).cuenta).toEqual({ broker: 'A', cuenta: '1' });
  });

  it('respeta una cuenta válida', () => {
    const filtro = { ...FILTRO_INICIAL, cuenta: { broker: 'B', cuenta: '1' } };
    expect(asegurarCuenta(filtro, cuentas)).toBe(filtro);
  });
});

describe('análisis por cuenta', () => {
  it('no mezcla operaciones de brokers distintos aunque la cuenta se llame igual', () => {
    const r = analizarPeriodo(datos, { ...FILTRO_INICIAL, cuenta: { broker: 'B', cuenta: '1' } });
    if (typeof r === 'string') throw new Error(r);
    expect(r.operaciones.map((o) => o.id)).toEqual(['B:1:1']);
  });

  it('los activos ofrecidos son solo los de la cuenta elegida', () => {
    expect(opcionesDelFiltro(datos, { broker: 'B', cuenta: '1' }).activos).toEqual(['XAUUSD']);
  });
});
