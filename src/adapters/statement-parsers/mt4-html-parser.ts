/**
 * Lector del informe HTML de MetaTrader 4 («Statement» y «DetailedStatement»).
 *
 * No usa el analizador de HTML del navegador: el informe lo genera la propia
 * plataforma con una estructura muy regular (filas y celdas de tabla), y así el
 * código funciona igual en el navegador y en las pruebas. El texto se extrae sin
 * etiquetas y nunca se vuelve a insertar como HTML.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { InformeParseado, TotalesInforme } from '../../models/informe';
import type { CierrePor, MovimientoInforme, OperacionInforme } from '../../models/operacion';
import type { ParserInforme } from '../../services/importacion/puertos';

interface Fila {
  readonly celdas: readonly string[];
  /** Atributo title de cada celda: en la primera celda MetaTrader guarda el comentario de la operación. */
  readonly titulos: readonly string[];
}

const COLUMNAS_OPERACION = 14;

function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/gi, '&');
}

function textoDeCelda(html: string): string {
  return decodificarEntidades(html.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

function tituloDeCelda(atributos: string): string {
  const coincidencia = /title="([^"]*)"/i.exec(atributos);
  return coincidencia?.[1] === undefined ? '' : decodificarEntidades(coincidencia[1]);
}

function extraerFilas(html: string): Fila[] {
  const filas: Fila[] = [];
  for (const fila of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const celdas: string[] = [];
    const titulos: string[] = [];
    for (const celda of (fila[1] ?? '').matchAll(/<td([^>]*)>([\s\S]*?)<\/td>/gi)) {
      titulos.push(tituloDeCelda(celda[1] ?? ''));
      celdas.push(textoDeCelda(celda[2] ?? ''));
    }
    filas.push({ celdas, titulos });
  }
  return filas;
}

function celda(fila: Fila, indice: number): string {
  return fila.celdas[indice] ?? '';
}

/** "1 234.50" -> 1234.5. Los miles se separan con espacios y los decimales con punto. */
function parsearNumero(texto: string, descripcion: string): number {
  const limpio = texto.replace(/\s/g, '');
  if (limpio === '') return 0;
  if (!/^-?\d+(\.\d+)?$/.test(limpio)) {
    throw new ErrorDeUsuario(`Número no válido en el informe (${descripcion}): «${texto}»`);
  }
  return Number(limpio);
}

/** Como parsearNumero, pero devuelve null en lugar de fallar: se usa en los totales, que son opcionales. */
function numeroONulo(texto: string): number | null {
  const limpio = texto.replace(/[\s%]/g, '');
  return /^-?\d+(\.\d+)?$/.test(limpio) ? Number(limpio) : null;
}

/** MetaTrader escribe 0 cuando no hay SL o TP. */
function precioOpcional(texto: string, descripcion: string): number | null {
  const valor = parsearNumero(texto, descripcion);
  return valor === 0 ? null : valor;
}

/** "2026.10.15 17:55:00" -> "2026-10-15T17:55:00" */
function parsearHora(texto: string, descripcion: string): string {
  const coincidencia = /^(\d{4})\.(\d{2})\.(\d{2}) (\d{2}:\d{2}:\d{2})$/.exec(texto.trim());
  if (!coincidencia) {
    throw new ErrorDeUsuario(`Fecha y hora no válidas en el informe (${descripcion}): «${texto}»`);
  }
  return `${coincidencia[1]}-${coincidencia[2]}-${coincidencia[3]}T${coincidencia[4]}`;
}

function esFilaDeOperacion(fila: Fila): boolean {
  const tipo = celda(fila, 2).toLowerCase();
  return fila.celdas.length >= COLUMNAS_OPERACION && (tipo === 'buy' || tipo === 'sell');
}

function esFilaDeMovimiento(fila: Fila): boolean {
  return fila.celdas.length >= 4 && celda(fila, 2).toLowerCase() === 'balance';
}

/** El comentario termina en [sl] o [tp] cuando la plataforma cerró la operación por stop loss o take profit. */
function detectarCierrePor(comentario: string): CierrePor {
  if (/\[sl\]/i.test(comentario)) return 'sl';
  if (/\[tp\]/i.test(comentario)) return 'tp';
  return 'manual';
}

function filaAOperacion(fila: Fila, abierta: boolean): OperacionInforme {
  const ticket = celda(fila, 0);
  const dato = (indice: number, nombre: string) => parsearNumero(celda(fila, indice), `${nombre} de la operación ${ticket}`);
  const comentario = fila.titulos[0] ?? '';

  return {
    ticket,
    tipo: celda(fila, 2).toLowerCase() === 'buy' ? 'compra' : 'venta',
    lotes: dato(3, 'tamaño'),
    activo: celda(fila, 4).toUpperCase(),
    precioEntrada: dato(5, 'precio de entrada'),
    stopLoss: precioOpcional(celda(fila, 6), `stop loss de la operación ${ticket}`),
    takeProfit: precioOpcional(celda(fila, 7), `take profit de la operación ${ticket}`),
    aperturaBroker: parsearHora(celda(fila, 1), `apertura de la operación ${ticket}`),
    cierreBroker: abierta ? null : parsearHora(celda(fila, 8), `cierre de la operación ${ticket}`),
    // En las abiertas, esta columna es el precio actual de mercado, no un precio de cierre.
    precioCierre: abierta ? null : dato(9, 'precio de cierre'),
    precioActual: abierta ? dato(9, 'precio actual') : null,
    comision: dato(10, 'comisión'),
    impuestos: dato(11, 'impuestos'),
    swap: dato(12, 'swap'),
    beneficio: dato(13, 'beneficio'),
    comentario,
    cierrePor: abierta ? null : detectarCierrePor(comentario),
  };
}

function filaAMovimiento(fila: Fila): MovimientoInforme {
  const ticket = celda(fila, 0);
  return {
    ticket,
    horaBroker: parsearHora(celda(fila, 1), `movimiento ${ticket}`),
    descripcion: celda(fila, 3),
    importe: parsearNumero(fila.celdas[fila.celdas.length - 1] ?? '', `movimiento ${ticket}`),
  };
}

// --- Cifras que trae el propio informe (resumen y detalles) ------------------

/** Etiqueta del informe (en minúsculas) -> campo donde se guarda su valor y, si lo hay, el número entre paréntesis. */
const CAMPOS_DE_TOTALES: Readonly<Record<string, { principal: keyof TotalesInforme; entreParentesis?: keyof TotalesInforme }>> = {
  'deposit/withdrawal:': { principal: 'depositos' },
  'closed trade p/l:': { principal: 'resultadoCerrado' },
  'floating p/l:': { principal: 'flotante' },
  'balance:': { principal: 'balance' },
  'gross profit:': { principal: 'beneficioBruto' },
  'gross loss:': { principal: 'perdidaBruta' },
  'total net profit:': { principal: 'beneficioNeto' },
  'profit factor:': { principal: 'factorBeneficio' },
  'expected payoff:': { principal: 'pagoEsperado' },
  'absolute drawdown:': { principal: 'drawdownAbsoluto' },
  'maximal drawdown:': { principal: 'drawdownMaximo', entreParentesis: 'drawdownMaximoPct' },
  'total trades:': { principal: 'totalOperaciones' },
  'short positions (won %):': { principal: 'cortas' },
  'long positions (won %):': { principal: 'largas' },
  'profit trades (% of total):': { principal: 'ganadoras' },
  'loss trades (% of total):': { principal: 'perdedoras' },
  'largest profit trade:': { principal: 'mayorGanancia' },
  'largest loss trade:': { principal: 'mayorPerdida' },
  'average profit trade:': { principal: 'gananciaMedia' },
  'average loss trade:': { principal: 'perdidaMedia' },
  'maximum consecutive wins ($):': { principal: 'rachaGanadoras', entreParentesis: 'rachaGanadorasImporte' },
  'maximum consecutive losses ($):': { principal: 'rachaPerdedoras', entreParentesis: 'rachaPerdedorasImporte' },
};

/** "58 318.08 (57.71%)" -> 58318.08 y 57.71 */
function separarValorYParentesis(texto: string): { principal: number | null; entreParentesis: number | null } {
  const abre = texto.indexOf('(');
  const principal = abre >= 0 ? texto.slice(0, abre) : texto;
  const entreParentesis = abre >= 0 ? texto.slice(abre + 1).replace(')', '') : '';
  return { principal: numeroONulo(principal), entreParentesis: numeroONulo(entreParentesis) };
}

/**
 * Las filas del resumen y los detalles son parejas «Etiqueta: valor». Algunas
 * llevan una palabra suelta al principio («Largest», «Average»…) que forma parte
 * de la etiqueta de todas las parejas de esa fila.
 */
function leerTotales(htmlResumen: string): TotalesInforme {
  const totales: TotalesInforme = {};
  for (const fila of extraerFilas(htmlResumen)) {
    const celdas = fila.celdas.filter((texto) => texto !== '');
    let prefijo = '';
    let hayEtiqueta = false;

    celdas.forEach((texto, indice) => {
      if (!texto.endsWith(':')) {
        if (!hayEtiqueta) prefijo = `${prefijo} ${texto}`.trim();
        return;
      }
      hayEtiqueta = true;
      const valor = celdas[indice + 1];
      if (valor === undefined || valor.endsWith(':')) return;

      const campo = CAMPOS_DE_TOTALES[`${prefijo} ${texto}`.trim().toLowerCase()];
      if (!campo) return;
      const { principal, entreParentesis } = separarValorYParentesis(valor);
      if (principal !== null) totales[campo.principal] = principal;
      if (campo.entreParentesis && entreParentesis !== null) totales[campo.entreParentesis] = entreParentesis;
    });
  }
  return totales;
}

// --- Informe completo -------------------------------------------------------

function textoDespuesDe(html: string, etiqueta: RegExp): string {
  return etiqueta.exec(html)?.[1]?.trim() ?? '';
}

function cortar(html: string, desde: number, hasta: number): string {
  return html.slice(desde, hasta < 0 ? html.length : hasta);
}

export function leerInformeMt4(html: string): InformeParseado {
  const inicioCerradas = html.indexOf('Closed Transactions:');
  const inicioAbiertas = html.indexOf('Open Trades:');
  if (inicioCerradas < 0 || inicioAbiertas < 0) {
    throw new ErrorDeUsuario(
      'El fichero no parece un informe de MetaTrader 4: falta la sección «Closed Transactions». ' +
        'Guarda el informe desde MetaTrader 4 (Historial de cuenta → clic derecho → Guardar como informe detallado).',
    );
  }
  const cuenta = textoDespuesDe(html, /Account:\s*(\d+)/);
  if (cuenta === '') throw new ErrorDeUsuario('No se encuentra el número de cuenta en el informe.');

  const inicioPendientes = html.indexOf('Working Orders:');
  const inicioResumen = html.indexOf('Summary:');
  const finAbiertas = inicioPendientes >= 0 ? inicioPendientes : inicioResumen;

  const filasCerradas = extraerFilas(cortar(html, inicioCerradas, inicioAbiertas));
  const filasAbiertas = extraerFilas(cortar(html, inicioAbiertas, finAbiertas));
  const totales = inicioResumen >= 0 ? leerTotales(html.slice(inicioResumen)) : {};

  return {
    cuenta,
    nombre: textoDespuesDe(html, /Name:\s*([^<]*)</),
    moneda: textoDespuesDe(html, /Currency:\s*([A-Za-z]{3})/),
    cerradas: filasCerradas.filter(esFilaDeOperacion).map((fila) => filaAOperacion(fila, false)),
    abiertas: filasAbiertas.filter(esFilaDeOperacion).map((fila) => filaAOperacion(fila, true)),
    movimientos: filasCerradas.filter(esFilaDeMovimiento).map(filaAMovimiento),
    totales,
    tieneBloqueDetalle: totales.totalOperaciones !== undefined,
  };
}

export class ParserMt4 implements ParserInforme {
  leer(contenido: string): InformeParseado {
    return leerInformeMt4(contenido);
  }
}
