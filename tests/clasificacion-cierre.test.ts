import { describe, expect, it } from 'vitest';
import { CLASIFICACION_CIERRE } from '../src/config/app-config';
import { FILTRO_INICIAL } from '../src/models/filtro';
import { crearClasificador } from '../src/services/analisis/clasificacion-cierre';
import { crearCalculadorSaldo } from '../src/services/analisis/saldo-apertura';
import { analizarPeriodo } from '../src/services/consultas/analisis-periodo';
import { crearOperacion } from './fixtures/operaciones';

const HORA = 3_600_000;
const T0 = Date.UTC(2026, 0, 1);
// Saldo 10 000 desde el 1 de enero: el 0,1 % son 10 USD.
const ingreso = { broker: 'B', cuenta: '1', utcMs: T0, importe: 10_000 } as never;

function op(ticket: string, beneficio: number, cierrePor: 'tp' | 'sl' | 'manual', extra = {}) {
  return crearOperacion(ticket, { beneficio, cierrePor, ...extra });
}

const datosCon = (operaciones: ReturnType<typeof op>[]) => ({ operaciones, movimientos: [ingreso] });
const clasificar = (o: ReturnType<typeof op>, otras: ReturnType<typeof op>[] = []) =>
  crearClasificador(datosCon([o, ...otras]), CLASIFICACION_CIERRE)(o);

describe('crearCalculadorSaldo', () => {
  it('suma ingresos y resultado de las operaciones ya cerradas', () => {
    const cerrada = op('1', 500, 'tp', { aperturaUtc: T0 + HORA, cierreUtc: T0 + 2 * HORA });
    const saldo = crearCalculadorSaldo(datosCon([cerrada]));
    expect(saldo({ broker: 'B', cuenta: '1' }, T0 + HORA)).toBe(10_000);
    expect(saldo({ broker: 'B', cuenta: '1' }, T0 + 3 * HORA)).toBe(10_500);
    expect(saldo({ broker: 'B', cuenta: '1' }, T0 - HORA)).toBe(0);
    expect(saldo({ broker: 'B', cuenta: 'otra' }, T0 + 3 * HORA)).toBe(0);
  });
});

describe('crearClasificador', () => {
  it('un stop que cierra con ganancia es take profit, no stop loss', () => {
    expect(clasificar(op('3', 300, 'sl'))).toBe('tp');
  });

  it('un stop con pérdida es stop loss', () => {
    expect(clasificar(op('4', -300, 'sl'))).toBe('sl');
  });

  it('un resultado menor del 0,1 % del saldo es break even', () => {
    expect(clasificar(op('5', 9, 'sl'))).toBe('break_even');
    expect(clasificar(op('6', -9, 'sl'))).toBe('break_even');
  });

  it('el 0,1 % exacto ya no es break even', () => {
    expect(clasificar(op('7', -10, 'sl'))).toBe('sl');
  });

  it('cuenta comisión y swap en el resultado', () => {
    expect(clasificar(op('8', 12, 'tp', { comision: -5, swap: -2 }))).toBe('break_even');
  });

  it('el cierre manual es manual, salvo que el resultado sea casi nulo', () => {
    expect(clasificar(op('9', 300, 'manual'))).toBe('manual');
    expect(clasificar(op('10', 3, 'manual'))).toBe('break_even');
  });

  it('el saldo de otro broker no cuenta, aunque la cuenta se llame igual', () => {
    const o = op('13', 3, 'sl');
    const otroBroker = { cuenta: 'X', broker: 'Otro', utcMs: T0, importe: 10_000 } as never;
    expect(crearClasificador({ operaciones: [o], movimientos: [otroBroker] }, CLASIFICACION_CIERRE)(o)).toBe('tp');
  });

  it('sin saldo conocido no hay break even', () => {
    const o = op('11', 1, 'tp');
    expect(crearClasificador({ operaciones: [o], movimientos: [] }, CLASIFICACION_CIERRE)(o)).toBe('tp');
  });

  it('una operación abierta no tiene clasificación', () => {
    expect(clasificar(crearOperacion('12', { cierreUtc: null }))).toBeNull();
  });
});

describe('filtro por cierre', () => {
  const datos = datosCon([op('10', 300, 'tp'), op('11', 200, 'sl'), op('12', -300, 'sl'), op('13', 100, 'manual'), op('14', 2, 'sl'), crearOperacion('15', { cierreUtc: null })]);
  const tickets = (cierre: 'tp' | 'sl' | 'break_even' | 'manual' | null) => {
    const r = analizarPeriodo(datos, { ...FILTRO_INICIAL, cierre });
    if (typeof r === 'string') throw new Error(r);
    return r.operaciones.map((o) => o.ticket).sort();
  };

  it('agrupa por resultado y no por la etiqueta de la plataforma', () => {
    expect(tickets('tp')).toEqual(['10', '11']);
    expect(tickets('sl')).toEqual(['12']);
    expect(tickets('manual')).toEqual(['13']);
    expect(tickets('break_even')).toEqual(['14']);
    expect(tickets(null)).toEqual(['10', '11', '12', '13', '14']);
  });

  it('con un cierre elegido no se muestran las operaciones abiertas', () => {
    const r = analizarPeriodo(datos, { ...FILTRO_INICIAL, cierre: 'tp' });
    expect(typeof r === 'string' ? -1 : r.abiertas.length).toBe(0);
  });
});
