import type { Plataforma } from '../../models/importacion';
import type { ParserInforme } from '../../services/importacion/puertos';
import { ParserMt4 } from './mt4-html-parser';

/** Un parser por plataforma. Para añadir MT5 o NinjaTrader: un fichero nuevo y una línea aquí. */
export function crearParsers(): Record<Plataforma, ParserInforme> {
  return { mt4: new ParserMt4() };
}
