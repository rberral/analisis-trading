import { describe, expect, it } from 'vitest';
import { ParserQuantfury } from '../src/adapters/statement-parsers/quantfury-texto-parser';
import { tipoInformeQuantfury } from '../src/adapters/statement-parsers/quantfury-comun';
import { leerEstadoEfectivo } from '../src/adapters/statement-parsers/quantfury-efectivo-parser';
import { leerEstadoTrading } from '../src/adapters/statement-parsers/quantfury-trading-parser';
import { ErrorDeUsuario } from '../src/core/errores';
import type { MovimientoGuardado, RegistroImportacion } from '../src/models/importacion';
import type { OperacionGuardada } from '../src/models/operacion';
import { crearClasificador } from '../src/services/analisis/clasificacion-cierre';
import { movimientosVigentes } from '../src/services/analisis/movimientos-vigentes';
import { resumirSaldo } from '../src/services/analisis/resumen-saldo';
import { ServicioImportacion } from '../src/services/importacion/importacion-service';
import type { DatosAGuardar } from '../src/services/importacion/puertos';
import { ParserMt4 } from '../src/adapters/statement-parsers/mt4-html-parser';
import { crearCalculadorSaldo } from '../src/services/analisis/saldo-apertura';
import { INFORME_QUANTFURY } from './fixtures/quantfury-informe';
import { ESTADO_EFECTIVO, ESTADO_TRADING } from './fixtures/quantfury-estados';

describe('tipoInformeQuantfury', () => {
  it('reconoce los tres informes por su título', () => {
    expect(tipoInformeQuantfury(INFORME_QUANTFURY)).toBe('historial');
    expect(tipoInformeQuantfury(ESTADO_EFECTIVO)).toBe('efectivo');
    expect(tipoInformeQuantfury(ESTADO_TRADING)).toBe('trading');
  });

  it('devuelve null si no es ninguno', () => {
    expect(tipoInformeQuantfury('Otro documento\nsin relación')).toBeNull();
  });

  it('ParserQuantfury elige el lector según el título y rechaza lo desconocido', () => {
    const parser = new ParserQuantfury();
    expect(parser.leer(ESTADO_EFECTIVO).movimientos).toHaveLength(3);
    expect(parser.leer(INFORME_QUANTFURY).cerradas.length > 0).toBe(true);
    expect(() => parser.leer('nada')).toThrow(ErrorDeUsuario);
  });
});

describe('leerEstadoEfectivo', () => {
  const informe = leerEstadoEfectivo(ESTADO_EFECTIVO);

  it('lee solo los traspasos con la cuenta de trading, con su signo y su valor en dólares', () => {
    expect(informe.movimientos.map((m) => [m.horaBroker, m.importe, m.clase])).toEqual([
      ['2024-11-03T08:34:33', 54.86, 'traspaso'],
      ['2025-01-28T22:33:31', 500, 'traspaso'],
      ['2025-07-30T18:54:47', -200, 'traspaso'],
    ]);
  });

  it('no tiene operaciones, exige USD y no da avisos si los totales anuales cuadran', () => {
    expect(informe.cerradas).toHaveLength(0);
    expect(informe.monedaObligatoria).toBe('USD');
    expect(informe.avisos).toEqual([]);
  });

  it('avisa si los traspasos de un año no suman lo que dice el informe', () => {
    const roto = ESTADO_EFECTIVO.replace('$500.00\nTransferencias desde', '$900.00\nTransferencias desde');
    expect(leerEstadoEfectivo(roto).avisos!.length).toBe(1);
  });

  it('rechaza un PDF que no es el estado de efectivo', () => {
    expect(() => leerEstadoEfectivo('hola')).toThrow(ErrorDeUsuario);
  });
});

describe('leerEstadoTrading', () => {
  const informe = leerEstadoTrading(ESTADO_TRADING);
  const clase = (c: string) => informe.movimientos.filter((m) => m.clase === c);

  it('lee los dividendos con su moneda', () => {
    expect(clase('dividendo').map((m) => [m.descripcion, m.importe, m.monedaOrigen])).toEqual([
      ['Dividendo MSFT', 1.37, 'USD'],
      ['Dividendo RACE', 6.14, 'EUR'],
    ]);
  });

  it('crea un movimiento anual con ingresos menos retiradas, solo de los años con diferencia', () => {
    expect(clase('anual').map((m) => [m.ticket, m.importe])).toEqual([
      ['ANUAL-2025', 1572.61],
      ['ANUAL-2024', -2864.07],
      ['ANUAL-2023', 54.35],
    ]);
    expect(clase('anual')[0]!.horaBroker).toBe('2025-12-31T23:59:59');
  });

  it('lee las recompensas del año', () => {
    expect(clase('recompensa').map((m) => [m.ticket, m.importe])).toEqual([['RECOMPENSAS-2026', 15.01]]);
  });

  it('lee el saldo, las no realizadas (suma de tipos de activo) y la fecha del informe', () => {
    expect(informe.resumenCuenta).toEqual({ horaBroker: '2026-11-12T13:33:46', patrimonio: 835.48, noRealizadas: -81.87 });
  });

  it('rechaza un PDF que no es el estado de trading', () => {
    expect(() => leerEstadoTrading('hola')).toThrow(ErrorDeUsuario);
  });
});

const CUENTA = { broker: 'Quantfury', cuenta: 'P' };
const ms = (iso: string) => Date.parse(`${iso}Z`);

function movimiento(id: string, iso: string, importe: number, clase?: MovimientoGuardado['clase']): MovimientoGuardado {
  return { id, ...CUENTA, moneda: 'USD', ticket: id, descripcion: id, importe, horaBroker: iso, utcMs: ms(iso), importacionId: 'i', ...(clase ? { clase } : {}) };
}

function operacion(ticket: string, abre: string, cierra: string, beneficio: number): OperacionGuardada {
  return {
    id: `Quantfury:P:${ticket}`, ...CUENTA, moneda: 'USD', ticket, tipo: 'compra', lotes: 1, activo: 'AAPL', precioEntrada: 1, stopLoss: null, takeProfit: null,
    aperturaBroker: abre, cierreBroker: cierra, precioCierre: 1, precioActual: null, comision: 0, impuestos: 0, swap: 0, beneficio, comentario: '', cierrePor: 'manual',
    aperturaUtc: ms(abre), cierreUtc: ms(cierra), importacionId: 'i', sinNivelesDeRiesgo: true,
  };
}

describe('movimientosVigentes', () => {
  it('descarta el total anual de un año que ya tiene traspasos con hora, y conserva los demás', () => {
    const todos = [
      movimiento('t1', '2025-02-01T10:00:00', 500, 'traspaso'),
      movimiento('a2025', '2025-12-31T23:59:59', 500, 'anual'),
      movimiento('a2022', '2022-12-31T23:59:59', 300, 'anual'),
      movimiento('d', '2025-03-01T10:00:00', 2, 'dividendo'),
    ];
    expect(movimientosVigentes(todos).map((m) => m.id)).toEqual(['t1', 'a2022', 'd']);
  });

  it('sin totales anuales devuelve los mismos movimientos', () => {
    const solo = [movimiento('t1', '2025-02-01T10:00:00', 500)];
    expect(movimientosVigentes(solo)).toBe(solo);
  });
});

describe('saldo de una cuenta sin ingresos conocidos', () => {
  it('es 0 (desconocido): así no se calcula el break even', () => {
    const datos = { operaciones: [operacion('1', '2026-01-01T10:00:00', '2026-01-01T11:00:00', 0.01), operacion('2', '2026-01-02T10:00:00', '2026-01-02T11:00:00', 5)], movimientos: [] };
    expect(crearCalculadorSaldo(datos)(CUENTA, ms('2026-01-02T10:00:00'))).toBe(0);
    const clasificar = crearClasificador(datos, { umbralBreakEvenPorcentaje: 0.1 });
    expect(clasificar(datos.operaciones[0]!)).toBe('manual');
  });

  it('con ingresos conocidos clasifica como break even lo que queda por debajo del 0,1 % del saldo al abrir', () => {
    const datos = {
      operaciones: [operacion('1', '2026-01-02T10:00:00', '2026-01-02T11:00:00', 0.5), operacion('2', '2026-01-03T10:00:00', '2026-01-03T11:00:00', 5)],
      movimientos: [movimiento('t1', '2026-01-01T10:00:00', 1000, 'traspaso')],
    };
    const clasificar = crearClasificador(datos, { umbralBreakEvenPorcentaje: 0.1 });
    expect(clasificar(datos.operaciones[0]!)).toBe('break_even');
    expect(clasificar(datos.operaciones[1]!)).toBe('manual');
  });
});

describe('resumirSaldo', () => {
  const registro = (extra: Partial<RegistroImportacion>): RegistroImportacion => ({
    id: 'r', ...CUENTA, moneda: 'USD', plataforma: 'quantfury', nombreFichero: 'f', horario: { tipo: 'zona', zona: 'UTC' }, fechaMs: 1, nuevas: 0, cerradasDesdeAbierta: 0, yaExistentes: 0, abiertas: 0, validacionCorrecta: true, ...extra,
  });
  const operaciones = [operacion('1', '2026-01-02T10:00:00', '2026-01-02T11:00:00', 50)];
  const resumen = { fechaUtcMs: ms('2026-02-01T00:00:00'), patrimonio: 1040, noRealizadas: -10 };

  it('no hay nada que mostrar sin saldo del broker ni apalancamiento', () => {
    expect(resumirSaldo({ operaciones, movimientos: [], importaciones: [registro({})] }, CUENTA, 5)).toBeNull();
  });

  it('el saldo disponible no incluye las no realizadas y se compara con el del broker', () => {
    const datos = { operaciones, movimientos: [movimiento('t1', '2026-01-01T10:00:00', 1000, 'traspaso')], importaciones: [registro({ resumenCuenta: resumen, apalancamiento: 5 })] };
    const r = resumirSaldo(datos, CUENTA, 5)!;
    expect(r.saldoDisponible).toBe(1050);
    expect(r.diferencia).toBe(0);
    expect(r.cuadra).toBe(true);
    expect(r.ingresosConHora).toBe(true);
    expect(r.noRealizadas).toBe(-10);
    expect(r.apalancamiento).toBe(5);
  });

  it('avisa de que no cuadra cuando falta dinero ingresado', () => {
    const datos = { operaciones, movimientos: [movimiento('t1', '2026-01-01T10:00:00', 900, 'traspaso')], importaciones: [registro({ resumenCuenta: resumen })] };
    const r = resumirSaldo(datos, CUENTA, 5)!;
    expect(r.diferencia).toBe(-100);
    expect(r.cuadra).toBe(false);
  });

  it('solo con apalancamiento se devuelve ese dato', () => {
    const r = resumirSaldo({ operaciones, movimientos: [], importaciones: [registro({ apalancamiento: 3 })] }, CUENTA, 5)!;
    expect(r.saldoDisponible).toBeNull();
    expect(r.apalancamiento).toBe(3);
  });
});

describe('ServicioImportacion con los estados de Quantfury', () => {
  const guardados: DatosAGuardar[] = [];
  const repositorio = {
    estadoDeOperaciones: async () => new Map<string, 'abierta' | 'cerrada'>(),
    monedaDeCuenta: async () => null,
    guardarImportacion: async (datos: DatosAGuardar) => void guardados.push(datos),
  };
  // Cambio de pruebas: 1 EUR = 1,10 USD, cualquier día.
  const proveedor = { obtenerSerie: async () => new Map([['2020-01-01', 1.1]]) };
  const servicio = new ServicioImportacion({ mt4: new ParserMt4(), quantfury: new ParserQuantfury() }, repositorio, { proveedor, equivalencias: { USDT: 'USD' } });
  const opciones = { plataforma: 'quantfury' as const, nombreFichero: 'estado.pdf', broker: 'Quantfury', cuenta: 'P', moneda: 'USD', horario: { tipo: 'zona', zona: 'UTC' } as const };

  it('importa el estado de trading: convierte los dividendos en euros y guarda saldo y apalancamiento', async () => {
    const resultado = await servicio.importar(ESTADO_TRADING, { ...opciones, apalancamiento: 5 });
    const datos = guardados[guardados.length - 1]!;
    const race = datos.movimientos.find((m) => m.descripcion === 'Dividendo RACE')!;
    expect(race.importe).toBe(6.75);
    expect(race.importeOrigen).toBe(6.14);
    expect(race.monedaOrigen).toBe('EUR');
    expect(datos.movimientos.find((m) => m.descripcion === 'Dividendo MSFT')!.clase).toBe('dividendo');
    expect(datos.importacion.apalancamiento).toBe(5);
    expect(datos.importacion.resumenCuenta!.patrimonio).toBe(835.48);
    expect(datos.importacion.resumenCuenta!.fechaUtcMs).toBe(ms('2026-11-12T13:33:46'));
    expect(resultado.nuevas).toBe(0);
    expect(resultado.comprobaciones).toEqual([]);
    expect(resultado.traeResumenCuenta).toBe(true);
  });

  it('importa el estado de efectivo como movimientos con su clase', async () => {
    const resultado = await servicio.importar(ESTADO_EFECTIVO, opciones);
    expect(resultado.movimientos).toBe(3);
    expect(guardados[guardados.length - 1]!.movimientos.every((m) => m.clase === 'traspaso')).toBe(true);
  });

  it('los estados de cuenta exigen una cuenta en USD', async () => {
    await expect(servicio.importar(ESTADO_EFECTIVO, { ...opciones, moneda: 'EUR' })).rejects.toThrow(ErrorDeUsuario);
  });

  it('rechaza un apalancamiento que no sea un número positivo', async () => {
    await expect(servicio.importar(ESTADO_EFECTIVO, { ...opciones, apalancamiento: 0 })).rejects.toThrow(ErrorDeUsuario);
    await expect(servicio.importar(ESTADO_EFECTIVO, { ...opciones, apalancamiento: -2 })).rejects.toThrow(ErrorDeUsuario);
  });
});
