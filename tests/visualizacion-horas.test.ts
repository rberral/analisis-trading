import { describe, expect, it } from 'vitest';
import { VISUALIZACION_HORAS } from '../src/config/app-config';
import { desfaseDelBrokerMs } from '../src/core/horario';
import type { HorarioBroker } from '../src/core/horario';
import { PreferenciaModoHora, type AlmacenClaveValor } from '../src/services/visualizacion/preferencia-modo-hora';
import { crearVisualizador } from '../src/services/visualizacion/visualizador-horas';

const HORA = 3_600_000;
const invierno = Date.UTC(2026, 0, 15, 12);
const verano = Date.UTC(2026, 6, 15, 12);
const atenas: HorarioBroker = { tipo: 'zona', zona: 'Europe/Athens' };

describe('desfaseDelBrokerMs', () => {
  it('Atenas: UTC+2 en invierno y UTC+3 en verano', () => {
    expect(desfaseDelBrokerMs(invierno, atenas)).toBe(2 * HORA);
    expect(desfaseDelBrokerMs(verano, atenas)).toBe(3 * HORA);
  });

  it('Nueva York + 7 horas', () => {
    const regla: HorarioBroker = { tipo: 'nueva_york_mas', horas: 7 };
    expect(desfaseDelBrokerMs(invierno, regla)).toBe(2 * HORA);
    expect(desfaseDelBrokerMs(verano, regla)).toBe(3 * HORA);
  });
});

describe('crearVisualizador', () => {
  const horarios = new Map([['imp1', atenas]]);
  const v = (modo: 'utc' | 'broker' | 'espana') => crearVisualizador(modo, horarios, VISUALIZACION_HORAS);

  it('en UTC no desplaza nada', () => {
    expect(v('utc').desfaseMs(verano, 'imp1')).toBe(0);
  });

  it('en hora del broker usa el horario de la importación de cada dato', () => {
    expect(v('broker').desfaseMs(invierno, 'imp1')).toBe(2 * HORA);
    expect(v('broker').desfaseMs(verano, 'imp1')).toBe(3 * HORA);
  });

  it('en hora del broker sin horario conocido no desplaza y no falla', () => {
    expect(v('broker').desfaseMs(invierno, 'desconocido')).toBe(0);
    expect(v('broker').desfaseMs(invierno, null)).toBe(0);
  });

  it('en hora de España: UTC+1 en invierno y UTC+2 en verano', () => {
    expect(v('espana').desfaseMs(invierno, null)).toBe(HORA);
    expect(v('espana').desfaseMs(verano, null)).toBe(2 * HORA);
  });

  it('conOrigen añade el horario de una carga recién analizada', () => {
    const con = v('broker').conOrigen('carga9', { tipo: 'zona', zona: 'Europe/Berlin' });
    expect(con.desfaseMs(invierno, 'carga9')).toBe(HORA);
    expect(con.desfaseMs(invierno, 'imp1')).toBe(2 * HORA);
  });

  it('la etiqueta indica el modo', () => {
    expect(v('utc').etiqueta).toBe('UTC');
    expect(v('broker').etiqueta).toBe('hora del broker');
  });
});

describe('PreferenciaModoHora', () => {
  function almacenEn(memoria: Map<string, string>): AlmacenClaveValor {
    return { leer: (c) => memoria.get(c) ?? null, escribir: (c, valor) => void memoria.set(c, valor) };
  }
  const crear = (memoria: Map<string, string>) => new PreferenciaModoHora(almacenEn(memoria), 'k', ['utc', 'broker', 'espana'], 'utc');

  it('empieza en el modo inicial y recuerda la elección', () => {
    const memoria = new Map<string, string>();
    const preferencia = crear(memoria);
    expect(preferencia.obtener()).toBe('utc');
    preferencia.fijar('espana');
    expect(crear(memoria).obtener()).toBe('espana');
  });

  it('ignora un valor guardado que ya no es válido', () => {
    expect(crear(new Map([['k', 'marte']])).obtener()).toBe('utc');
  });
});
