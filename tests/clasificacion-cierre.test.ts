import { describe, expect, it } from 'vitest';
import { CLASIFICACION_CIERRE } from '../src/config/app-config';
import { FILTRO_INICIAL } from '../src/models/filtro';
import { crearClasificador, dineroPorUnidadDePrecio } from '../src/services/analisis/clasificacion-cierre';
import { analizarPeriodo } from '../src/services/consultas/analisis-periodo';
import { crearOperacion } from './fixtures/operaciones';

// EURUSD: 1 lote = 100 000 USD por unidad de precio; 1 pip (0,0001) = 10 USD.
function eurusd(ticket: string, movimientoPrecio: number, cierrePor: 'tp' | 'sl' | 'manual', lotes = 1) {
  return crearOperacion(ticket, {
    lotes,
    precioEntrada: 1.1,
    precioCierre: 1.1 + movimientoPrecio,
    beneficio: movimientoPrecio * 100_000 * lotes,
    cierrePor,
  });
}

const base = [eurusd('1', 0.002, 'tp'), eurusd('2', -0.001, 'sl')];
const clasificar = crearClasificador(base, CLASIFICACION_CIERRE);

describe('dineroPorUnidadDePrecio', () => {
  it('deduce el tamaño del contrato a partir de las operaciones', () => {
    expect(dineroPorUnidadDePrecio(base).get('EURUSD')).toBeCloseTo(100_000, 3);
  });
});

describe('crearClasificador', () => {
  it('un stop que cierra con ganancia es take profit, no stop loss', () => {
    expect(clasificar(eurusd('3', 0.0015, 'sl'))).toBe('tp');
  });

  it('un stop con pérdida es stop loss', () => {
    expect(clasificar(eurusd('4', -0.0012, 'sl'))).toBe('sl');
  });

  it('un movimiento de menos de 0,01 % del valor es break even', () => {
    // 0,00005 = medio pip: 0,0045 % del precio.
    expect(clasificar(eurusd('5', 0.00005, 'sl'))).toBe('break_even');
    expect(clasificar(eurusd('6', -0.00005, 'sl'))).toBe('break_even');
  });

  it('un movimiento de 11 pips (el 0,1 %) ya no es break even', () => {
    expect(clasificar(eurusd('7', -0.0011, 'sl'))).toBe('sl');
  });

  it('el cierre manual siempre es manual', () => {
    expect(clasificar(eurusd('8', 0.0001, 'manual'))).toBe('manual');
  });

  it('una operación abierta no tiene clasificación', () => {
    expect(clasificar(crearOperacion('9', { cierreUtc: null }))).toBeNull();
  });
});

describe('filtro por cierre', () => {
  const datos = {
    operaciones: [eurusd('10', 0.002, 'tp'), eurusd('11', 0.0015, 'sl'), eurusd('12', -0.001, 'sl'), eurusd('13', 0.0003, 'manual'), crearOperacion('14', { cierreUtc: null })],
    movimientos: [],
  };
  const tickets = (cierre: 'tp' | 'sl' | 'break_even' | 'manual' | null) => {
    const r = analizarPeriodo(datos, { ...FILTRO_INICIAL, cierre });
    if (typeof r === 'string') throw new Error(r);
    return r.operaciones.map((o) => o.ticket).sort();
  };

  it('agrupa por resultado y no por la etiqueta de la plataforma', () => {
    expect(tickets('tp')).toEqual(['10', '11']);
    expect(tickets('sl')).toEqual(['12']);
    expect(tickets('manual')).toEqual(['13']);
    expect(tickets(null)).toEqual(['10', '11', '12', '13']);
  });

  it('con un cierre elegido no se muestran las operaciones abiertas', () => {
    const r = analizarPeriodo(datos, { ...FILTRO_INICIAL, cierre: 'tp' });
    expect(typeof r === 'string' ? -1 : r.abiertas.length).toBe(0);
  });
});
