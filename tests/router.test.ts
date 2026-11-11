import { describe, expect, it } from 'vitest';
import { resolverRuta } from '../src/core/router';
import { SECCIONES } from '../src/config/app-config';

describe('resolverRuta', () => {
  it('usa el panel cuando no hay hash', () => {
    expect(resolverRuta('')).toBe('/');
    expect(resolverRuta('#')).toBe('/');
  });

  it('mantiene rutas que ya empiezan por barra', () => {
    expect(resolverRuta('#/operaciones')).toBe('/operaciones');
  });

  it('añade la barra inicial si falta', () => {
    expect(resolverRuta('#errores')).toBe('/errores');
  });
});

describe('secciones', () => {
  it('no repite rutas', () => {
    const rutas = SECCIONES.map((seccion) => seccion.ruta);
    expect(new Set(rutas).size).toBe(rutas.length);
  });
});
