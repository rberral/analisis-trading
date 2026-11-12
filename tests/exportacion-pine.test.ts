import { describe, expect, it } from 'vitest';
import { CLASIFICACION_CIERRE, EXPORTACION_TRADINGVIEW, VISUALIZACION_HORAS } from '../src/config/app-config';
import { FILTRO_INICIAL, type Filtro } from '../src/models/filtro';
import { crearCalculadorSaldo } from '../src/services/analisis/saldo-apertura';
import { analizarPeriodo } from '../src/services/consultas/analisis-periodo';
import { generarScriptsPine, partirEnTrozos, tamanosDePartes, nombreDeFichero } from '../src/services/exportacion/generador-pine';
import { crearVisualizador } from '../src/services/visualizacion/visualizador-horas';
import { crearOperacion } from './fixtures/operaciones';

const HORA = 3_600_000;
const T0 = Date.UTC(2026, 0, 5, 10);
const ingreso = { broker: 'B', cuenta: '1', utcMs: T0 - HORA, importe: 10_000 } as never;
const parametros = {
  maximoOperacionesPorScript: 3,
  tamanoTrozo: EXPORTACION_TRADINGVIEW.tamanoTrozo,
  anchoCajaBarras: 20,
  umbralBreakEvenPorcentaje: CLASIFICACION_CIERRE.umbralBreakEvenPorcentaje,
};

function generar(operaciones: ReturnType<typeof crearOperacion>[], modo: 'utc' | 'espana' = 'utc', simbolos = {}, p = parametros, filtro: Filtro = FILTRO_INICIAL) {
  const datos = { operaciones, movimientos: [ingreso] };
  const analisis = analizarPeriodo(datos, filtro);
  if (typeof analisis === 'string') throw new Error(analisis);
  return generarScriptsPine(
    { analisis, saldoEn: crearCalculadorSaldo(datos), horas: crearVisualizador(modo, new Map(), VISUALIZACION_HORAS), simbolos, filtro },
    p,
  );
}

const op = (n: number, extra = {}) => crearOperacion(String(n), { aperturaUtc: T0 + n * 24 * HORA, cierreUtc: T0 + n * 24 * HORA + HORA, beneficio: 300, cierrePor: 'sl', ...extra });

describe('partirEnTrozos', () => {
  it('no pasa del tamaño indicado', () => {
    const trozos = partirEnTrozos(['aaaa', 'bbbb', 'cccc'], 9);
    expect(trozos).toEqual(['aaaa;bbbb', 'cccc']);
  });
});

describe('tamanosDePartes', () => {
  it('reparte en partes equilibradas', () => {
    expect(tamanosDePartes(7, 3)).toEqual([3, 2, 2]);
    expect(tamanosDePartes(3, 3)).toEqual([3]);
    expect(tamanosDePartes(0, 3)).toEqual([0]);
  });
});

describe('generarScriptsPine', () => {
  it('crea un script por activo y rellena todas las marcas', () => {
    const scripts = generar([op(1), op(2, { activo: 'XAUUSD' })]);
    expect(scripts.map((s) => s.activo)).toEqual(['EURUSD', 'XAUUSD']);
    for (const s of scripts) {
      expect(s.codigo.includes('@@')).toBe(false);
      expect(s.codigo).toContain('//@version=6');
      expect(s.nombreFichero.endsWith('.pine')).toBe(true);
    }
  });

  it('parte en varios scripts si supera el límite, sin perder operaciones', () => {
    const scripts = generar([1, 2, 3, 4, 5, 6, 7].map((n) => op(n)));
    expect(scripts.map((s) => s.operaciones)).toEqual([3, 2, 2]);
    expect(scripts[1]?.nombreFichero).toBe('Total_EURUSD_parte2de3.pine');
  });

  it('usa el símbolo de TradingView indicado', () => {
    const [script] = generar([op(1, { activo: 'SP500' })], 'utc', { SP500: 'SPX' });
    expect(script?.simboloTradingView).toBe('SPX');
    expect(script?.codigo).toContain('SIMBOLO_TV = "SPX"');
  });

  it('codifica 14 campos por operación, con motivo según el resultado', () => {
    const [script] = generar([op(1)]);
    const linea = script?.codigo.split('\n').find((l) => l.startsWith('DATOS_1 = '));
    const campos = linea?.replace('DATOS_1 = "', '').replace('"', '').split(',') ?? [];
    expect(campos).toHaveLength(14);
    expect(campos[1]).toBe('1');
    expect(campos[10]).toBe('t'); // etiquetada «sl» pero ganó: take profit
    expect(campos[11]).toBe('10000.00'); // saldo al abrir
  });

  it('el desfase de las horas depende del modo elegido', () => {
    const campos = (modo: 'utc' | 'espana') => {
      const [script] = generar([op(1)], modo);
      const linea = script?.codigo.split('\n').find((l) => l.startsWith('DATOS_1 = ')) ?? '';
      return linea.replace('DATOS_1 = "', '').replace('"', '').split(',');
    };
    expect(campos('utc').slice(12)).toEqual(['0', '0']);
    expect(campos('espana').slice(12)).toEqual(['60', '60']); // enero: UTC+1
  });

  it('una operación abierta lleva motivo «o» y sin salida', () => {
    const [script] = generar([crearOperacion('9', { cierreUtc: null, cierrePor: null, precioCierre: null })]);
    const linea = script?.codigo.split('\n').find((l) => l.startsWith('DATOS_1 = ')) ?? '';
    const campos = linea.replace('DATOS_1 = "', '').replace('"', '').split(',');
    expect(campos[7]).toBe('0');
    expect(campos[10]).toBe('o');
  });
});

describe('nombreDeFichero', () => {
  const nombre = (filtro: Partial<Filtro>, simbolo = 'EURUSD', parte = 1, partes = 1) => nombreDeFichero({ ...FILTRO_INICIAL, ...filtro }, simbolo, parte, partes);

  it('es PERIODO_ACTIVO.pine', () => {
    expect(nombre({})).toBe('Total_EURUSD.pine');
    expect(nombre({ periodo: { tipo: 'anio', anio: 2026 } })).toBe('2026_EURUSD.pine');
    expect(nombre({ periodo: { tipo: 'trimestre', anio: 2026, trimestre: 1 } })).toBe('2026-T1_EURUSD.pine');
    expect(nombre({ periodo: { tipo: 'mes', anio: 2026, mes: 3 } })).toBe('2026-03_EURUSD.pine');
    expect(nombre({ periodo: { tipo: 'rango', desde: '2026-01-01', hasta: '2026-03-15' } })).toBe('2026-01-01_2026-03-15_EURUSD.pine');
  });

  it('añade el cierre filtrado y la parte', () => {
    expect(nombre({ cierre: 'tp' }, 'SPX', 2, 3)).toBe('Total_SPX_TP_parte2de3.pine');
  });

  it('limpia caracteres no válidos del símbolo', () => {
    expect(nombre({}, 'US/500')).toBe('Total_US_500.pine');
  });
});
