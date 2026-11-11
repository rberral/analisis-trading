import { APP_CONFIG } from '../config/app-config';

type Nivel = 'debug' | 'info' | 'warn' | 'error';

const ORDEN: Record<Nivel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

function escribir(nivel: Nivel, mensaje: string, detalle?: unknown): void {
  if (ORDEN[nivel] < ORDEN[APP_CONFIG.nivelLog]) return;
  const texto = `[${nivel}] ${mensaje}`;
  if (detalle === undefined) {
    console[nivel](texto);
    return;
  }
  console[nivel](texto, detalle);
}

/** Registro de mensajes. No se deben pasar datos personales de operaciones. */
export const logger = {
  debug: (mensaje: string, detalle?: unknown) => escribir('debug', mensaje, detalle),
  info: (mensaje: string, detalle?: unknown) => escribir('info', mensaje, detalle),
  warn: (mensaje: string, detalle?: unknown) => escribir('warn', mensaje, detalle),
  error: (mensaje: string, detalle?: unknown) => escribir('error', mensaje, detalle),
};
