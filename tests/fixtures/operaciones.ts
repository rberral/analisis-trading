import type { OperacionGuardada } from '../../src/models/operacion';

const HORA = 3_600_000;

/** Crea una operación guardada con valores razonables; solo hay que indicar lo que importa en cada test. */
export function crearOperacion(ticket: string, cambios: Partial<OperacionGuardada> = {}): OperacionGuardada {
  const aperturaUtc = cambios.aperturaUtc ?? Date.UTC(2026, 0, 5, 10);
  return {
    id: `1:${ticket}`,
    cuenta: '1',
    importacionId: 'imp',
    ticket,
    tipo: 'compra',
    lotes: 1,
    activo: 'EURUSD',
    precioEntrada: 1.1,
    stopLoss: 1.09,
    takeProfit: 1.12,
    aperturaBroker: '2026-01-05T12:00:00',
    cierreBroker: '2026-01-05T14:00:00',
    precioCierre: 1.11,
    precioActual: null,
    comision: 0,
    impuestos: 0,
    swap: 0,
    beneficio: 10,
    comentario: '',
    cierrePor: 'manual',
    aperturaUtc,
    cierreUtc: aperturaUtc + 2 * HORA,
    ...cambios,
  };
}
