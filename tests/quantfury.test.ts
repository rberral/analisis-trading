import { describe, expect, it } from 'vitest';
import { agruparEnLineas } from '../src/adapters/pdf/agrupar-lineas';
import { leerInformeQuantfury } from '../src/adapters/statement-parsers/quantfury-texto-parser';
import { ErrorDeUsuario } from '../src/core/errores';
import { INFORME_QUANTFURY } from './fixtures/quantfury-informe';

describe('leerInformeQuantfury', () => {
  const informe = leerInformeQuantfury(INFORME_QUANTFURY);
  const por = (activo: string) => informe.cerradas.find((o) => o.activo === activo)!;

  it('separa posiciones cerradas y abiertas', () => {
    expect(informe.cerradas).toHaveLength(7);
    expect(informe.abiertas).toHaveLength(3);
    expect(informe.nombre).toBe('CLIENTE DE PRUEBA');
    expect(informe.avisos).toEqual([]);
  });

  it('une apertura, ampliaciones y reducciones en una sola operación', () => {
    const baba = por('BABA');
    expect(baba.tipo).toBe('compra');
    expect(baba.lotes).toBe(6);
    expect(baba.aperturaBroker).toBe('2024-03-05T14:30:02');
    expect(baba.cierreBroker).toBe('2024-10-17T13:30:04');
    expect(baba.beneficio).toBe(54.31);
    expect(baba.monedaOrigen).toBe('USD');
    expect(baba.precioEntrada).toBeCloseTo((71.27 * 2 + 76.78 * 2 + 76.71 * 2) / 6, 6);
  });

  it('convierte la hora de 12 h a 24 h', () => {
    expect(por('REP').aperturaBroker).toBe('2025-01-31T11:12:53');
    expect(por('NIO').aperturaBroker).toBe('2024-04-29T14:10:44');
    expect(informe.cerradas.find((o) => o.activo === 'BTCUSDT')!.cierreBroker).toBe('2021-03-05T00:21:43');
  });

  it('lee la moneda de cada resultado y los importes con el símbolo separado', () => {
    expect(por('REP').monedaOrigen).toBe('EUR');
    expect(por('REP').beneficio).toBe(3.25);
    const cripto = por('BTCUSDT');
    expect(cripto.beneficio).toBe(-5.95);
    expect(cripto.monedaOrigen).toBe('USDT');
    expect(por('USDJPY').monedaOrigen).toBe('JPY');
    expect(por('USDJPY').beneficio).toBe(-77.4);
  });

  it('reconoce las ventas en corto y deduce la cantidad cuando el informe solo da el valor', () => {
    const futuro = por('ESM22');
    expect(futuro.tipo).toBe('venta');
    expect(futuro.lotes).toBeCloseTo(500 / 4131, 8);
    expect(por('EURUSD').tipo).toBe('venta');
  });

  it('las posiciones abiertas no tienen cierre ni resultado, y ampliar no crea otra', () => {
    const nke = informe.abiertas.find((o) => o.activo === 'NKE')!;
    expect(nke.cierreBroker).toBeNull();
    expect(nke.cierrePor).toBeNull();
    expect(nke.lotes).toBeCloseTo(2.4746 + 3.6206, 6);
    expect(nke.beneficio).toBe(0);
    expect(informe.abiertas.map((o) => o.activo)).toEqual(['NKE', 'PATH', 'BCHUSDT']);
  });

  it('el identificador es estable: activo y hora de apertura', () => {
    expect(por('BABA').ticket).toBe('BABA-20240305143002');
    expect(informe.abiertas[0]!.ticket).toBe('NKE-20260626133333');
  });

  it('trae las cifras de control del propio informe', () => {
    expect(informe.totales.totalOperaciones).toBe(7);
    expect(informe.totales.beneficioNeto).toBeCloseTo(54.31 + 3.25 - 7.7 - 0.85 - 5.95 - 0.03 - 77.4, 6);
  });

  it('avisa si las filas de una posición no suman su total', () => {
    const roto = INFORME_QUANTFURY.replace('Total -$7.70', 'Total -$9.00');
    expect(leerInformeQuantfury(roto).avisos?.[0]).toContain('NIO-20240429141044');
  });

  it('rechaza un texto que no es un informe de Quantfury', () => {
    expect(() => leerInformeQuantfury('Otro documento')).toThrow(ErrorDeUsuario);
  });
});

describe('agruparEnLineas', () => {
  it('une los fragmentos de la misma altura de izquierda a derecha y ordena de arriba abajo', () => {
    const lineas = agruparEnLineas([
      { texto: '$ 50.00', x: 300, y: 100 },
      { texto: 'BTC', x: 10, y: 100.5 },
      { texto: 'Total', x: 10, y: 80 },
      { texto: ' ', x: 5, y: 90 },
    ]);
    expect(lineas).toEqual(['BTC $ 50.00', 'Total']);
  });
});

describe('errores con Quantfury', () => {
  it('no marca «sin stop loss» cuando la plataforma no informa de stops', async () => {
    const { detectarErrores } = await import('../src/services/errores/detector-errores');
    const { UMBRALES_ERRORES } = await import('../src/config/app-config');
    const { crearOperacion } = await import('./fixtures/operaciones');
    const { calcularEstadisticas } = await import('../src/services/estadisticas/calculadora-estadisticas');
    const operaciones = Array.from({ length: 15 }, (_, i) => crearOperacion(String(i), { stopLoss: null, sinNivelesDeRiesgo: true, aperturaUtc: Date.UTC(2026, 0, 5 + i, 10), cierreUtc: Date.UTC(2026, 0, 5 + i, 10, 1) }));
    const estadisticas = calcularEstadisticas(operaciones.map((o) => ({ ...o, cierre: '' })), 0);
    const errores = detectarErrores(operaciones, estadisticas, UMBRALES_ERRORES);
    expect(errores).toHaveLength(0);
  });
});
