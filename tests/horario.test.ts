import { describe, expect, it } from 'vitest';
import { convertirHoraBrokerAUtc, validarHorario, type HorarioBroker } from '../src/core/horario';

const atenas: HorarioBroker = { tipo: 'zona', zona: 'Europe/Athens' };
const nuevaYorkMas7: HorarioBroker = { tipo: 'nueva_york_mas', horas: 7 };

describe('convertirHoraBrokerAUtc con zona con nombre', () => {
  it('convierte una hora de invierno (UTC+2)', () => {
    const r = convertirHoraBrokerAUtc('2026-01-15T12:00:00', atenas);
    expect(r.estado).toBe('normal');
    expect(new Date(r.utcMs).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('convierte una hora de verano (UTC+3)', () => {
    const r = convertirHoraBrokerAUtc('2026-07-15T12:00:00', atenas);
    expect(new Date(r.utcMs).toISOString()).toBe('2026-07-15T09:00:00.000Z');
  });

  it('detecta la hora inexistente del cambio de marzo', () => {
    // 2026-03-29 03:30 no existe en Atenas: a las 03:00 se pasa a las 04:00.
    expect(convertirHoraBrokerAUtc('2026-03-29T03:30:00', atenas).estado).toBe('inexistente');
  });

  it('detecta la hora repetida del cambio de octubre y usa la primera', () => {
    const r = convertirHoraBrokerAUtc('2026-10-25T03:30:00', atenas);
    expect(r.estado).toBe('ambigua');
    expect(new Date(r.utcMs).toISOString()).toBe('2026-10-25T00:30:00.000Z');
  });
});

describe('convertirHoraBrokerAUtc con la regla Nueva York + 7', () => {
  it('en invierno equivale a UTC+2', () => {
    const r = convertirHoraBrokerAUtc('2026-01-15T12:00:00', nuevaYorkMas7);
    expect(new Date(r.utcMs).toISOString()).toBe('2026-01-15T10:00:00.000Z');
  });

  it('en verano equivale a UTC+3', () => {
    const r = convertirHoraBrokerAUtc('2026-07-15T12:00:00', nuevaYorkMas7);
    expect(new Date(r.utcMs).toISOString()).toBe('2026-07-15T09:00:00.000Z');
  });
});

describe('validarHorario', () => {
  it('acepta una zona válida', () => expect(validarHorario(atenas)).toBeNull());
  it('rechaza una zona inventada', () =>
    expect(validarHorario({ tipo: 'zona', zona: 'Marte/Olympus' })).not.toBeNull());
  it('rechaza un desfase vacío o fuera de rango', () => {
    expect(validarHorario({ tipo: 'nueva_york_mas', horas: Number.NaN })).not.toBeNull();
    expect(validarHorario({ tipo: 'nueva_york_mas', horas: 20 })).not.toBeNull();
  });
});
