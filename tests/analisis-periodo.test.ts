import { describe, expect, it } from 'vitest';
import { FILTRO_INICIAL } from '../src/models/filtro';
import type { MovimientoGuardado } from '../src/models/importacion';
import { analizarPeriodo, opcionesDelFiltro, type AnalisisPeriodo } from '../src/services/consultas/analisis-periodo';
import { crearOperacion } from './fixtures/operaciones';

const deposito: MovimientoGuardado = {
  id: '1:1', cuenta: '1', ticket: '1', descripcion: 'Depósito', importe: 1000,
  horaBroker: '2025-12-31T00:00:00', utcMs: Date.UTC(2025, 11, 31), importacionId: 'imp',
};

const enero = crearOperacion('10', { beneficio: 100, aperturaUtc: Date.UTC(2026, 0, 5, 10) });
const febrero = crearOperacion('11', { beneficio: -40, activo: 'XAUUSD', aperturaUtc: Date.UTC(2026, 1, 5, 10) });
const abierta = crearOperacion('12', { cierreUtc: null, aperturaUtc: Date.UTC(2026, 1, 9, 10) });
const datos = { operaciones: [febrero, enero, abierta], movimientos: [deposito] };

function analizar(filtro = FILTRO_INICIAL): AnalisisPeriodo {
  const resultado = analizarPeriodo(datos, filtro);
  if (typeof resultado === 'string') throw new Error(resultado);
  return resultado;
}

describe('analizarPeriodo', () => {
  it('en el total usa todas las operaciones cerradas y el depósito inicial', () => {
    const a = analizar();
    expect(a.operaciones.map((o) => o.ticket)).toEqual(['10', '11']);
    expect(a.balanceInicial).toBe(1000);
    expect(a.estadisticas.beneficioNeto).toBe(60);
    expect(a.curva.map((p) => p.balance)).toEqual([1100, 1060]);
    expect(a.abiertas.map((o) => o.ticket)).toEqual(['12']);
  });

  it('en un mes parte del balance que había al empezar ese mes', () => {
    const a = analizar({ periodo: { tipo: 'mes', anio: 2026, mes: 2 }, activo: null, cuenta: null, cierre: null });
    expect(a.operaciones.map((o) => o.ticket)).toEqual(['11']);
    expect(a.balanceInicial).toBe(1100);
    expect(a.estadisticas.drawdownMaximo).toBe(40);
  });

  it('filtra por activo', () => {
    const a = analizar({ periodo: { tipo: 'total' }, activo: 'XAUUSD', cuenta: null, cierre: null });
    expect(a.operaciones.map((o) => o.ticket)).toEqual(['11']);
    expect(a.abiertas).toHaveLength(0);
  });

  it('devuelve un mensaje si el periodo no es válido', () => {
    expect(typeof analizarPeriodo(datos, { periodo: { tipo: 'rango', desde: '', hasta: '' }, activo: null, cuenta: null, cierre: null })).toBe('string');
  });

  it('funciona sin operaciones', () => {
    const vacio = analizarPeriodo({ operaciones: [], movimientos: [] }, FILTRO_INICIAL);
    expect(typeof vacio).not.toBe('string');
  });
});

describe('opcionesDelFiltro', () => {
  it('lista activos, cuentas y años con cierres (años más recientes primero)', () => {
    expect(opcionesDelFiltro(datos)).toEqual({ activos: ['EURUSD', 'XAUUSD'], cuentas: ['1'], anios: [2026] });
  });
});
