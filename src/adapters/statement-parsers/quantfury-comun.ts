/**
 * Piezas que comparten los tres informes PDF de Quantfury (historial, efectivo y trading):
 * monedas, importes con símbolo, fechas y reconocimiento del tipo de informe.
 */
import { ErrorDeUsuario } from '../../core/errores';

export type TipoInformeQuantfury = 'historial' | 'efectivo' | 'trading';

export const SIMBOLOS_MONEDA: Readonly<Record<string, string>> = { $: 'USD', '€': 'EUR', '¥': 'JPY', '£': 'GBP', '₮': 'USDT' };
export const CLASE_SIMBOLO = '[$€¥£₮]';

const TITULOS: ReadonlyArray<readonly [TipoInformeQuantfury, string]> = [
  ['historial', 'Informe del historial de trading'],
  ['efectivo', 'Estado de la cuenta en efectivo'],
  ['trading', 'Estado de la cuenta de trading'],
];

/** Reconoce el informe por su título (primeras líneas); null si no es ninguno de los tres. */
export function tipoInformeQuantfury(texto: string): TipoInformeQuantfury | null {
  const cabecera = texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter((linea) => linea !== '')
    .slice(0, 5);
  return TITULOS.find(([, titulo]) => cabecera.includes(titulo))?.[0] ?? null;
}

export const TEXTO_TIPO_INFORME: Readonly<Record<TipoInformeQuantfury, string>> = {
  historial: 'el informe del historial de trading',
  efectivo: 'el estado de la cuenta en efectivo',
  trading: 'el estado de la cuenta de trading',
};

export function importeDe(texto: string): { importe: number; moneda: string } {
  const limpio = texto.replace(/\s+/g, '');
  const simbolo = new RegExp(CLASE_SIMBOLO).exec(limpio)?.[0] ?? '';
  const moneda = SIMBOLOS_MONEDA[simbolo];
  if (moneda === undefined) throw new ErrorDeUsuario(`Moneda no reconocida en «${texto}». Quantfury usa $, €, ¥ o ₮ en los informes.`);
  const numero = Number(limpio.replace(new RegExp(CLASE_SIMBOLO), '').replace(/[+,]/g, ''));
  if (!Number.isFinite(numero)) throw new ErrorDeUsuario(`No se entiende el importe «${texto}».`);
  return { importe: numero, moneda };
}

export function numeroDe(texto: string): number {
  const numero = Number(texto.replace(new RegExp(CLASE_SIMBOLO, 'g'), '').replace(/,/g, ''));
  if (!Number.isFinite(numero)) throw new ErrorDeUsuario(`No se entiende el número «${texto}».`);
  return numero;
}

/** El PDF separa a veces el símbolo de la moneda del número («- $ 7.70»): se pega para tratarlo como un solo trozo. */
export function pegarSimbolos(texto: string): string {
  return texto
    .replace(new RegExp(`([+-])\\s+(?=${CLASE_SIMBOLO})`, 'g'), '$1')
    .replace(new RegExp(`(${CLASE_SIMBOLO})\\s+(?=\\d)`, 'g'), '$1');
}

/** "26", "06", "2026", "1", "33", "33", "PM" -> "2026-06-26T13:33:33". */
export function horaIso(dia: string, mes: string, anio: string, hora: string, minuto: string, segundo: string, ampm: string): string {
  const base = Number(hora) % 12;
  const hora24 = ampm === 'PM' ? base + 12 : base;
  return `${anio}-${mes}-${dia}T${String(hora24).padStart(2, '0')}:${minuto}:${segundo}`;
}

/** "2026-06-26T13:33:33" -> "20260626133333": sirve de identificador, porque Quantfury no numera sus filas. */
export const marcaDeHora = (hora: string): string => hora.replace(/[-:T]/g, '');

const MESES: Readonly<Record<string, string>> = {
  ene: '01', feb: '02', mar: '03', abr: '04', may: '05', jun: '06', jul: '07', ago: '08', sep: '09', sept: '09', oct: '10', nov: '11', dic: '12',
};

/** "12 nov 2026" -> "2026-11-12"; null si no es una fecha escrita así. */
export function fechaEscrita(texto: string): string | null {
  const coincidencia = /^(\d{1,2})\s+([a-záéíóú]{3,4})\.?\s+(\d{4})$/i.exec(texto.trim());
  const mes = coincidencia ? MESES[coincidencia[2]!.toLowerCase()] : undefined;
  return coincidencia && mes ? `${coincidencia[3]}-${mes}-${coincidencia[1]!.padStart(2, '0')}` : null;
}

export const sumar = (valores: readonly number[]): number => valores.reduce((suma, valor) => suma + valor, 0);
export const redondear2 = (valor: number): number => Math.round(valor * 100) / 100;
