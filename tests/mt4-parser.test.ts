import { describe, expect, it } from 'vitest';
import { ParserMt4 } from '../src/adapters/statement-parsers/mt4-html-parser';
import { ErrorDeUsuario } from '../src/core/errores';
import { INFORME_MT4_EJEMPLO } from './fixtures/informe-mt4';

describe('ParserMt4', () => {
  const informe = new ParserMt4().leer(INFORME_MT4_EJEMPLO);

  it('lee los datos de la cuenta', () => {
    expect(informe.cuenta).toBe('1000001');
    expect(informe.moneda).toBe('USD');
  });

  it('lee las operaciones cerradas con tipo, activo en mayúsculas y cierre', () => {
    expect(informe.cerradas).toHaveLength(4);
    const primera = informe.cerradas.find((o) => o.ticket === '1001');
    expect(primera?.tipo).toBe('compra');
    expect(primera?.activo).toBe('EURUSD');
    expect(primera?.aperturaBroker).toBe('2026-01-05T10:00:00');
    expect(primera?.cierrePor).toBe('tp');
    expect(informe.cerradas.find((o) => o.ticket === '1002')?.cierrePor).toBe('sl');
    expect(informe.cerradas.find((o) => o.ticket === '1003')?.cierrePor).toBe('manual');
  });

  it('interpreta números con espacios de millar y SL/TP a cero como ausentes', () => {
    const oro = informe.cerradas.find((o) => o.ticket === '1003');
    expect(oro?.precioEntrada).toBe(2000);
    expect(oro?.stopLoss).toBeNull();
    expect(oro?.takeProfit).toBeNull();
  });

  it('lee la operación abierta y los movimientos de balance', () => {
    expect(informe.abiertas.map((o) => o.ticket)).toEqual(['1007']);
    expect(informe.abiertas[0]?.cierreBroker).toBeNull();
    expect(informe.movimientos).toHaveLength(2);
  });

  it('lee los totales del informe', () => {
    expect(informe.tieneBloqueDetalle).toBe(true);
    expect(informe.totales.balance).toBe(10031.5);
    expect(informe.totales.drawdownMaximo).toBe(85);
    expect(informe.totales.drawdownMaximoPct).toBe(0.84);
    expect(informe.totales.rachaPerdedoras).toBe(2);
  });

  it('rechaza un fichero que no es un informe', () => {
    expect(() => new ParserMt4().leer('<html>hola</html>')).toThrow(ErrorDeUsuario);
  });
});
