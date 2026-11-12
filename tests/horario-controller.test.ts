import { describe, expect, it } from 'vitest';
import { HORARIOS_PREDEFINIDOS, OPCION_OTRA_REGLA, OPCION_OTRA_ZONA } from '../src/config/app-config';
import { ErrorDeUsuario } from '../src/core/errores';
import { validarHorario } from '../src/core/horario';
import { construirHorario } from '../src/controllers/horario-controller';

describe('HORARIOS_PREDEFINIDOS', () => {
  it('todos los horarios de la lista son válidos', () => {
    for (const opcion of HORARIOS_PREDEFINIDOS) expect(validarHorario(opcion.horario)).toBeNull();
  });

  it('Europa del Este equivale a Atenas', () => {
    expect(HORARIOS_PREDEFINIDOS.find((o) => o.id === 'europa_este')?.horario).toEqual({ tipo: 'zona', zona: 'Europe/Athens' });
  });
});

describe('construirHorario', () => {
  it('sin elegir nada exige un horario', () => {
    expect(() => construirHorario({ opcionHorario: '', zona: '', horas: '' })).toThrow(ErrorDeUsuario);
  });

  it('devuelve el horario de la opción elegida', () => {
    expect(construirHorario({ opcionHorario: 'nueva_york_mas_7', zona: '', horas: '' })).toEqual({ tipo: 'nueva_york_mas', horas: 7 });
  });

  it('lee la zona y la regla escritas a mano', () => {
    expect(construirHorario({ opcionHorario: OPCION_OTRA_ZONA, zona: 'Asia/Dubai', horas: '' })).toEqual({ tipo: 'zona', zona: 'Asia/Dubai' });
    expect(construirHorario({ opcionHorario: OPCION_OTRA_REGLA, zona: '', horas: '8' })).toEqual({ tipo: 'nueva_york_mas', horas: 8 });
  });

  it('rechaza una opción desconocida', () => {
    expect(() => construirHorario({ opcionHorario: 'inventado', zona: '', horas: '' })).toThrow(ErrorDeUsuario);
  });
});
