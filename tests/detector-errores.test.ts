import { describe, expect, it } from 'vitest';
import { UMBRALES_ERRORES } from '../src/config/app-config';
import type { OperacionGuardada } from '../src/models/operacion';
import { calcularEstadisticas } from '../src/services/estadisticas/calculadora-estadisticas';
import { detectarErrores } from '../src/services/errores/detector-errores';
import { crearOperacion } from './fixtures/operaciones';

const DIA = 86_400_000;

function detectar(operaciones: OperacionGuardada[]) {
  const estadisticas = calcularEstadisticas(operaciones.map((o) => ({ ...o, cierre: o.cierreUtc ?? 0 })), 1000);
  return detectarErrores(operaciones, estadisticas, UMBRALES_ERRORES);
}

/** Diez operaciones normales, un día cada una, para superar el mínimo exigido. */
function base(): OperacionGuardada[] {
  return Array.from({ length: 10 }, (_, i) =>
    crearOperacion(String(100 + i), { aperturaUtc: Date.UTC(2026, 0, 5) + i * DIA, beneficio: i % 2 === 0 ? 20 : -10 }),
  );
}

describe('detectarErrores', () => {
  it('no analiza con pocas operaciones', () => {
    expect(detectar(base().slice(0, 5))).toEqual([]);
  });

  it('no encuentra nada en operaciones sanas', () => {
    expect(detectar(base())).toEqual([]);
  });

  it('detecta operaciones sin stop loss', () => {
    const operaciones = base();
    operaciones[3] = crearOperacion('999', { stopLoss: null, aperturaUtc: Date.UTC(2026, 0, 8) });
    const errores = detectar(operaciones);
    expect(errores.map((e) => e.codigo)).toContain('sin_stop_loss');
    expect(errores.find((e) => e.codigo === 'sin_stop_loss')?.tickets).toEqual(['999']);
  });

  it('detecta una pérdida desproporcionada', () => {
    const operaciones = base();
    operaciones[1] = crearOperacion('998', { beneficio: -500, aperturaUtc: Date.UTC(2026, 0, 6) });
    expect(detectar(operaciones).map((e) => e.codigo)).toContain('perdida_desproporcionada');
  });

  it('detecta que se suben los lotes tras una pérdida', () => {
    const operaciones = base();
    // La operación 101 (índice 1) pierde; la 102 abre con el doble de lotes.
    operaciones[2] = crearOperacion('997', { lotes: 2, beneficio: 20, aperturaUtc: Date.UTC(2026, 0, 7) });
    const error = detectar(operaciones).find((e) => e.codigo === 'lotes_tras_perdida');
    expect(error?.tickets).toEqual(['997']);
  });

  it('detecta días con demasiadas operaciones', () => {
    const operaciones = base();
    for (let i = 0; i < 9; i++) {
      operaciones.push(crearOperacion(`2${i}`, { aperturaUtc: Date.UTC(2026, 1, 1, 8) + i * 600_000, beneficio: 5 }));
    }
    expect(detectar(operaciones).map((e) => e.codigo)).toContain('sobreoperacion');
  });

  it('detecta perdedoras mucho más largas que las ganadoras', () => {
    const operaciones: OperacionGuardada[] = [];
    for (let i = 0; i < 6; i++) {
      const apertura = Date.UTC(2026, 0, 5) + i * 2 * DIA;
      operaciones.push(crearOperacion(`g${i}`, { aperturaUtc: apertura, cierreUtc: apertura + 3_600_000, beneficio: 20 }));
      operaciones.push(crearOperacion(`p${i}`, { aperturaUtc: apertura + DIA, cierreUtc: apertura + DIA + 10 * 3_600_000, beneficio: -10 }));
    }
    expect(detectar(operaciones).map((e) => e.codigo)).toContain('perdedoras_largas');
  });
});
