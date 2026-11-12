import { describe, expect, it } from 'vitest';
import { ESTRATEGIA, TEMPORALIDADES } from '../src/config/app-config';
import type { Vela, VentanaVelas } from '../src/models/velas';
import { calcularRecorrido, evaluarSalidaPosterior } from '../src/services/analisis/recorrido';
import { crearPerfil } from '../src/services/analisis/perfil-estrategia';
import { indexarVentanas, velaQueContiene } from '../src/services/analisis/ventanas-operacion';
import { detectarSalidasAnticipadas } from '../src/services/errores/detector-salidas';
import { crearOperacion } from './fixtures/operaciones';

const MIN = 60_000;
const M5 = 5 * MIN;
const T0 = Date.UTC(2026, 0, 5, 10, 0);

/** Vela de 5 minutos que empieza `n` velas después de T0. */
function vela(n: number, maximo: number, minimo: number): Vela {
  return { utcMs: T0 + n * M5, abre: minimo, maximo, minimo, cierra: maximo, volumen: 1 };
}

describe('calcularRecorrido', () => {
  // Compra a 1,1000 con SL 1,0950 y TP 1,1100; abre en T0 y cierra 25 min después a 1,1050.
  const compra = crearOperacion('1', { precioEntrada: 1.1, stopLoss: 1.095, takeProfit: 1.11, aperturaUtc: T0, cierreUtc: T0 + 5 * M5, precioCierre: 1.105 });
  const velas = [vela(0, 1.101, 1.0995), vela(1, 1.107, 1.098), vela(2, 1.104, 1.099), vela(3, 1.106, 1.1), vela(4, 1.108, 1.104), vela(5, 1.12, 1.09)];

  it('mide el máximo a favor y en contra con las velas completas dentro de la operación', () => {
    const r = calcularRecorrido(compra, velas, M5)!;
    expect(r.velasUsadas).toBe(5);
    expect(r.mfe).toBeCloseTo(0.008, 6);
    expect(r.mae).toBeCloseTo(0.002, 6);
    expect(r.mfePorcentajeTp).toBeCloseTo(80, 4);
    expect(r.maePorcentajeSl).toBeCloseTo(40, 4);
  });

  it('en una venta el máximo a favor es hacia abajo', () => {
    const venta = crearOperacion('2', { tipo: 'venta', precioEntrada: 1.1, stopLoss: 1.105, takeProfit: 1.09, aperturaUtc: T0, cierreUtc: T0 + 3 * M5, precioCierre: 1.098 });
    const r = calcularRecorrido(venta, [vela(0, 1.101, 1.097), vela(1, 1.102, 1.096), vela(2, 1.1, 1.098)], M5)!;
    expect(r.mfe).toBeCloseTo(0.004, 6);
    expect(r.mae).toBeCloseTo(0.002, 6);
  });

  it('sin velas completas usa solo los precios de entrada y salida', () => {
    const corta = crearOperacion('3', { precioEntrada: 1.1, precioCierre: 1.101, aperturaUtc: T0 + 30_000, cierreUtc: T0 + 40_000 });
    const r = calcularRecorrido(corta, velas, M5)!;
    expect(r.velasUsadas).toBe(0);
    expect(r.mfe).toBeCloseTo(0.001, 6);
    expect(r.mae).toBe(0);
  });

  it('un stop loss en el precio de entrada (break even) no da porcentaje', () => {
    const be = crearOperacion('4', { precioEntrada: 1.1, stopLoss: 1.1, takeProfit: 1.11, aperturaUtc: T0, cierreUtc: T0 + 5 * M5, precioCierre: 1.1 });
    expect(calcularRecorrido(be, velas, M5)!.maePorcentajeSl).toBeNull();
  });

  it('no calcula nada para operaciones abiertas', () => {
    expect(calcularRecorrido(crearOperacion('5', { cierreUtc: null }), velas, M5)).toBeNull();
  });
});

describe('evaluarSalidaPosterior', () => {
  const cerradaAMano = crearOperacion('6', { precioEntrada: 1.1, stopLoss: 1.095, takeProfit: 1.11, aperturaUtc: T0, cierreUtc: T0 + 2 * M5, cierrePor: 'manual', precioCierre: 1.104 });

  it('detecta que el precio llegó al TP después de cerrar', () => {
    expect(evaluarSalidaPosterior(cerradaAMano, [vela(2, 1.105, 1.103), vela(3, 1.111, 1.104)]).resultado).toBe('tp_alcanzado');
  });

  it('detecta que el precio fue al SL (el cierre a mano ayudó)', () => {
    expect(evaluarSalidaPosterior(cerradaAMano, [vela(2, 1.103, 1.094)]).resultado).toBe('sl_alcanzado');
  });

  it('si una misma vela toca TP y SL, se da por bueno el SL', () => {
    expect(evaluarSalidaPosterior(cerradaAMano, [vela(2, 1.112, 1.094)]).resultado).toBe('sl_alcanzado');
  });

  it('no mira la vela que contiene el cierre', () => {
    expect(evaluarSalidaPosterior(cerradaAMano, [vela(1, 1.12, 1.1)]).resultado).toBe('ninguno');
  });

  it('solo aplica a cierres manuales con take profit', () => {
    expect(evaluarSalidaPosterior({ ...cerradaAMano, cierrePor: 'tp' }, [vela(3, 1.2, 1)]).resultado).toBe('no_aplica');
    expect(evaluarSalidaPosterior({ ...cerradaAMano, takeProfit: null }, [vela(3, 1.2, 1)]).resultado).toBe('no_aplica');
  });
});

describe('detectarSalidasAnticipadas', () => {
  it('agrupa las operaciones que habrían llegado al TP', () => {
    const op = crearOperacion('7', { precioEntrada: 1.1, takeProfit: 1.11, stopLoss: 1.095, aperturaUtc: T0, cierreUtc: T0 + 2 * M5, cierrePor: 'manual', precioCierre: 1.104, beneficio: 40 });
    const ventana: VentanaVelas = { id: `${op.id}:M5`, operacionId: op.id, cuenta: '1', activo: 'EURUSD', temporalidad: 'M5', cargaId: 'c', truncada: false, velas: [vela(3, 1.111, 1.104)] };
    const errores = detectarSalidasAnticipadas([op], new Map([[op.id, ventana]]));
    expect(errores).toHaveLength(1);
    expect(errores[0]?.tickets).toEqual(['7']);
  });

  it('no dice nada sin velas', () => {
    expect(detectarSalidasAnticipadas([crearOperacion('8', { cierrePor: 'manual' })], new Map())).toEqual([]);
  });
});

describe('ventanas', () => {
  it('elige la ventana de velas más pequeñas por operación', () => {
    const base = { operacionId: 'x', cuenta: '1', activo: 'EURUSD', cargaId: 'c', truncada: false, velas: [] };
    const indice = indexarVentanas([{ ...base, id: 'x:H1', temporalidad: 'H1' }, { ...base, id: 'x:M5', temporalidad: 'M5' }], TEMPORALIDADES);
    expect(indice.get('x')?.temporalidad).toBe('M5');
  });

  it('encuentra la vela que contiene un instante', () => {
    const velas = [vela(0, 1, 1), vela(1, 1, 1)];
    expect(velaQueContiene(velas, T0 + 7 * MIN, M5)?.utcMs).toBe(T0 + M5);
    expect(velaQueContiene(velas, T0 + 11 * MIN, M5)).toBeNull();
  });
});

describe('crearPerfil', () => {
  const duracion = () => M5;

  it('describe duración, sesiones y uso de SL/TP', () => {
    const operaciones = Array.from({ length: 10 }, (_, i) =>
      crearOperacion(String(i), { aperturaUtc: Date.UTC(2026, 0, 5 + i, 8), cierreUtc: Date.UTC(2026, 0, 5 + i, 8, 10), stopLoss: i < 8 ? 1.09 : null, takeProfit: null }),
    );
    const perfil = crearPerfil(operaciones, new Map(), duracion, ESTRATEGIA)!;
    expect(perfil.estilo).toBe('scalping');
    expect(perfil.duracionMedianaMinutos).toBe(10);
    expect(perfil.porcentajeConStopLoss).toBe(80);
    expect(perfil.sesiones.find((s) => s.nombre === 'Londres')?.porcentaje).toBe(100);
    expect(perfil.entradas).toBeNull();
  });

  it('detecta entradas de seguimiento: compras en los máximos recientes', () => {
    const ventanas = new Map<string, VentanaVelas>();
    const operaciones = Array.from({ length: 12 }, (_, i) => {
      const apertura = T0 + 40 * M5 + i * 100 * M5;
      const op = crearOperacion(String(i), { aperturaUtc: apertura, cierreUtc: apertura + M5, precioEntrada: 1.105 });
      // 20 velas previas con rango 1,100-1,105: la entrada a 1,105 está en el máximo.
      const velas = Array.from({ length: 20 }, (_, k) => ({ utcMs: apertura - (20 - k) * M5, abre: 1.1, maximo: 1.105, minimo: 1.1, cierra: 1.1, volumen: 1 }));
      ventanas.set(op.id, { id: `${op.id}:M5`, operacionId: op.id, cuenta: '1', activo: 'EURUSD', temporalidad: 'M5', cargaId: 'c', truncada: false, velas });
      return op;
    });
    const entradas = crearPerfil(operaciones, ventanas, duracion, ESTRATEGIA)!.entradas!;
    expect(entradas.muestras).toBe(12);
    expect(entradas.seguimiento).toBe(12);
  });

  it('es swing si buena parte de las operaciones dura un día o más, aunque la mediana sea corta', () => {
    const DIA = 24 * 60 * MIN;
    const operaciones = Array.from({ length: 10 }, (_, i) => {
      const apertura = Date.UTC(2026, 0, 5 + i, 8);
      return crearOperacion(String(i), { aperturaUtc: apertura, cierreUtc: apertura + (i < 4 ? 2 * DIA : 2 * 60 * MIN) });
    });
    const perfil = crearPerfil(operaciones, new Map(), duracion, ESTRATEGIA)!;
    expect(perfil.duracionMedianaMinutos).toBe(120);
    expect(perfil.distribucionDuracion.undiaOMas).toBe(40);
    expect(perfil.estilo).toBe('swing');
  });

  it('devuelve null sin operaciones', () => {
    expect(crearPerfil([], new Map(), duracion, ESTRATEGIA)).toBeNull();
  });
});
