import { describe, expect, it } from 'vitest';
import { ErrorDeUsuario } from '../src/core/errores';
import { ParserQuantfury } from '../src/adapters/statement-parsers/quantfury-texto-parser';
import { ServicioImportacion } from '../src/services/importacion/importacion-service';
import { cambioDelDia, convertirOperaciones, ErrorCambioNecesario, type ProveedorTasasHistoricas } from '../src/services/importacion/conversion-moneda';
import type { OperacionInforme } from '../src/models/operacion';
import { INFORME_QUANTFURY } from './fixtures/quantfury-informe';

const base: OperacionInforme = {
  ticket: 'X', tipo: 'compra', lotes: 1, activo: 'REP', precioEntrada: 1, stopLoss: null, takeProfit: null,
  aperturaBroker: '2025-03-10T10:00:00', cierreBroker: '2025-03-15T10:00:00', precioCierre: 1, precioActual: null,
  comision: 0, impuestos: 0, swap: 0, beneficio: 10, comentario: '', cierrePor: 'manual', monedaOrigen: 'EUR',
};

/** Proveedor de pruebas: 1 EUR = 1,10 USD hasta el 12 de marzo y 1,20 desde el 13. */
const proveedor: ProveedorTasasHistoricas = {
  async obtenerSerie() {
    return new Map([['2025-03-07', 1.1], ['2025-03-13', 1.2]]);
  },
};
const parametros = { monedaCuenta: 'USD', equivalencias: { USDT: 'USD' }, cambiosManuales: {}, proveedor };

describe('cambioDelDia', () => {
  const serie = new Map([['2025-03-07', 1.1], ['2025-03-13', 1.2]]);
  it('usa el último cambio disponible hasta ese día', () => {
    expect(cambioDelDia(serie, '2025-03-09')).toBe(1.1);
    expect(cambioDelDia(serie, '2025-03-13')).toBe(1.2);
    expect(cambioDelDia(serie, '2025-04-01')).toBe(1.2);
  });
  it('si el día es anterior a todos, usa el primero', () => {
    expect(cambioDelDia(serie, '2025-01-01')).toBe(1.1);
  });
});

describe('convertirOperaciones', () => {
  it('convierte con el cambio del día de cierre y guarda el importe original', async () => {
    const r = await convertirOperaciones([base], parametros);
    const o = r.operaciones[0]!;
    expect([o.beneficio, o.beneficioOrigen, o.tipoCambio, o.monedaOrigen]).toEqual([12, 10, 1.2, 'EUR']);
    expect(r.convertidas).toBe(1);
    expect(r.monedasConvertidas).toEqual(['EUR']);
  });

  it('no toca lo que ya está en la moneda de la cuenta, y USDT cuenta como USD', async () => {
    const usd = { ...base, monedaOrigen: 'USD' };
    const usdt = { ...base, monedaOrigen: 'USDT' };
    const r = await convertirOperaciones([usd, usdt], parametros);
    expect(r.convertidas).toBe(0);
    expect(r.operaciones[1]!.beneficio).toBe(10);
    expect(r.operaciones[1]!.beneficioOrigen).toBe(undefined);
  });

  it('un cambio manual tiene prioridad y no consulta el proveedor', async () => {
    const r = await convertirOperaciones([base], { ...parametros, cambiosManuales: { EUR: 1.5 }, proveedor: null });
    expect(r.operaciones[0]!.beneficio).toBe(15);
    expect(r.operaciones[0]!.tipoCambio).toBe(1.5);
  });

  it('sin conexión pide un cambio manual para las monedas que faltan', async () => {
    const roto: ProveedorTasasHistoricas = { obtenerSerie: () => Promise.reject(new Error('sin red')) };
    const intento = convertirOperaciones([base], { ...parametros, proveedor: roto });
    await expect(intento).rejects.toThrow(ErrorCambioNecesario);
    await intento.catch((error: ErrorCambioNecesario) => expect(error.monedas).toEqual(['EUR']));
  });
});

describe('importar un informe de Quantfury', () => {
  function crear() {
    const guardado: { operaciones: { id: string; beneficio: number; moneda: string }[] } = { operaciones: [] };
    const repositorio = {
      estadoDeOperaciones: async () => new Map(),
      monedaDeCuenta: async () => null,
      guardarImportacion: async (datos: { operaciones: { id: string; beneficio: number; moneda: string }[] }) => {
        guardado.operaciones = datos.operaciones;
      },
    };
    const servicio = new ServicioImportacion({ mt4: new ParserQuantfury(), quantfury: new ParserQuantfury() }, repositorio as never, {
      proveedor: { obtenerSerie: async () => new Map([['2020-01-01', 2]]) },
      equivalencias: { USDT: 'USD' },
    });
    return { servicio, guardado };
  }
  const opciones = { plataforma: 'quantfury' as const, nombreFichero: 'q.pdf', broker: 'Quantfury', cuenta: 'Principal', moneda: 'USD', horario: { tipo: 'zona' as const, zona: 'UTC' } };

  it('guarda todo en la moneda de la cuenta, convirtiendo lo que está en otras', async () => {
    const { servicio, guardado } = crear();
    const resultado = await servicio.importar(INFORME_QUANTFURY, opciones);
    expect(resultado.nuevas).toBe(10);
    expect(resultado.abiertas).toBe(3);
    expect(resultado.convertidas).toBe(2); // EUR y JPY; el resultado de EURUSD está en $
    const rep = guardado.operaciones.find((o) => o.id === 'Quantfury:Principal:REP-20250131111253')!;
    expect(rep.beneficio).toBe(6.5); // 3,25 € x 2
    expect(rep.moneda).toBe('USD');
    expect(guardado.operaciones.find((o) => o.id.includes('BTCUSDT'))!.beneficio).toBe(-5.95);
  });

  it('sin moneda de cuenta pide indicarla', async () => {
    const { servicio } = crear();
    await expect(servicio.importar(INFORME_QUANTFURY, { ...opciones, moneda: '' })).rejects.toThrow(ErrorDeUsuario);
  });
});
