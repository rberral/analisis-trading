import { describe, expect, it } from 'vitest';
import { operacionesSinVelas } from '../src/services/velas/cobertura';
import type { VentanaVelas } from '../src/models/velas';
import { crearOperacion } from './fixtures/operaciones';

const ventana = (operacionId: string) => ({ id: `${operacionId}:M5`, operacionId }) as VentanaVelas;

describe('operacionesSinVelas', () => {
  const a = crearOperacion('1', { id: 'B:1:1' });
  const b = crearOperacion('2', { id: 'B:1:2' });
  const c = crearOperacion('3', { id: 'B:1:3', activo: 'XAUUSD' });
  const abierta = crearOperacion('4', { id: 'B:1:4', cierreUtc: null });

  it('agrupa por activo las cerradas sin velas', () => {
    expect(operacionesSinVelas([a, b, c], [])).toEqual([{ activo: 'EURUSD', cantidad: 2 }, { activo: 'XAUUSD', cantidad: 1 }]);
  });

  it('ignora las que ya tienen velas y las abiertas', () => {
    expect(operacionesSinVelas([a, b, c, abierta], [ventana('B:1:1'), ventana('B:1:3')])).toEqual([{ activo: 'EURUSD', cantidad: 1 }]);
  });

  it('no devuelve nada si todo tiene velas', () => {
    expect(operacionesSinVelas([a], [ventana('B:1:1')])).toEqual([]);
  });
});
