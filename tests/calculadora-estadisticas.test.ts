import { describe, expect, it } from 'vitest';
import { calcularEstadisticas, type OperacionCalculable } from '../src/services/estadisticas/calculadora-estadisticas';

function operacion(ticket: string, tipo: 'compra' | 'venta', cierre: number, neto: number): OperacionCalculable {
  return { ticket, tipo, comision: 0, impuestos: 0, swap: 0, beneficio: neto, cierre };
}

const OPERACIONES = [
  operacion('4', 'venta', 4, 18),
  operacion('3', 'compra', 3, -33),
  operacion('2', 'venta', 2, -52),
  operacion('1', 'compra', 1, 98),
];

describe('calcularEstadisticas', () => {
  const e = calcularEstadisticas(OPERACIONES, 10000);

  it('cuenta operaciones por tipo y resultado', () => {
    expect(e.totalOperaciones).toBe(4);
    expect(e.largas).toBe(2);
    expect(e.cortas).toBe(2);
    expect(e.ganadoras).toBe(2);
    expect(e.perdedoras).toBe(2);
  });

  it('calcula beneficio, pérdida y factor', () => {
    expect(e.beneficioBruto).toBe(116);
    expect(e.perdidaBruta).toBe(-85);
    expect(e.beneficioNeto).toBe(31);
    expect(e.factorBeneficio).toBeCloseTo(1.36, 2);
  });

  it('calcula rachas aunque lleguen desordenadas', () => {
    expect(e.rachaGanadoras).toBe(1);
    expect(e.rachaPerdedoras).toBe(2);
    expect(e.rachaPerdedorasImporte).toBe(-85);
  });

  it('calcula el drawdown máximo desde un máximo del balance', () => {
    expect(e.drawdownMaximo).toBe(85);
    expect(e.drawdownMaximoPct).toBeCloseTo(0.84, 2);
  });

  it('no falla sin operaciones', () => {
    const vacio = calcularEstadisticas([], 10000);
    expect(vacio.totalOperaciones).toBe(0);
    expect(vacio.factorBeneficio).toBeNull();
  });
});
