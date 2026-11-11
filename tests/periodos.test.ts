import { describe, expect, it } from 'vitest';
import { estaEnRango, rangoDePeriodo, type RangoUtc } from '../src/services/consultas/periodos';

const rango = (valor: ReturnType<typeof rangoDePeriodo>): RangoUtc => {
  if (typeof valor === 'string') throw new Error(valor);
  return valor;
};

describe('rangoDePeriodo', () => {
  it('el total no tiene límites', () => {
    expect(rangoDePeriodo({ tipo: 'total' })).toEqual({ desdeMs: null, hastaMs: null });
  });

  it('un año va del 1 de enero al 1 de enero siguiente', () => {
    const r = rango(rangoDePeriodo({ tipo: 'anio', anio: 2026 }));
    expect(new Date(r.desdeMs ?? 0).toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(new Date(r.hastaMs ?? 0).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('el último trimestre termina en el año siguiente', () => {
    const r = rango(rangoDePeriodo({ tipo: 'trimestre', anio: 2026, trimestre: 4 }));
    expect(new Date(r.desdeMs ?? 0).toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect(new Date(r.hastaMs ?? 0).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('diciembre termina en enero del año siguiente', () => {
    const r = rango(rangoDePeriodo({ tipo: 'mes', anio: 2026, mes: 12 }));
    expect(new Date(r.hastaMs ?? 0).toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  it('el rango de fechas incluye el último día completo', () => {
    const r = rango(rangoDePeriodo({ tipo: 'rango', desde: '2026-01-05', hasta: '2026-01-06' }));
    expect(estaEnRango(Date.UTC(2026, 0, 6, 23, 59), r)).toBe(true);
    expect(estaEnRango(Date.UTC(2026, 0, 7, 0, 0), r)).toBe(false);
  });

  it('rechaza fechas vacías, imposibles o al revés', () => {
    expect(typeof rangoDePeriodo({ tipo: 'rango', desde: '', hasta: '' })).toBe('string');
    expect(typeof rangoDePeriodo({ tipo: 'rango', desde: '2026-02-31', hasta: '2026-03-01' })).toBe('string');
    expect(typeof rangoDePeriodo({ tipo: 'rango', desde: '2026-03-02', hasta: '2026-03-01' })).toBe('string');
  });
});
