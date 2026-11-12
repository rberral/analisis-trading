/**
 * Convierte las operaciones filtradas en scripts Pine para TradingView: uno por activo y,
 * si superan el límite de dibujos de Pine, varios (parte 1 de N…).
 */
import type { ClasificacionCierre, Filtro } from '../../models/filtro';
import type { OperacionGuardada } from '../../models/operacion';
import { netoOperacion, type CalculadorSaldo } from '../analisis/saldo-apertura';
import type { AnalisisPeriodo } from '../consultas/analisis-periodo';
import type { VisualizadorHoras } from '../visualizacion/visualizador-horas';
import { PLANTILLA_PINE } from './plantilla-pine';

export interface ParametrosExportacion {
  readonly maximoOperacionesPorScript: number;
  readonly tamanoTrozo: number;
  readonly anchoCajaBarras: number;
  /** % de break even que llevará el script por defecto. */
  readonly umbralBreakEvenPorcentaje: number;
}

export interface ScriptPine {
  readonly nombreFichero: string;
  readonly activo: string;
  readonly simboloTradingView: string;
  readonly parte: number;
  readonly partes: number;
  readonly operaciones: number;
  readonly codigo: string;
}

export interface EntradaExportacion {
  readonly analisis: AnalisisPeriodo;
  readonly saldoEn: CalculadorSaldo;
  readonly horas: VisualizadorHoras;
  /** Nombre en TradingView de cada activo (los que falten usan el del broker). */
  readonly simbolos: Readonly<Record<string, string>>;
  /** Texto corto de los filtros, para la cabecera del script. */
  readonly descripcionFiltros: string;
}

const MS_POR_MINUTO = 60_000;

/** Letra del motivo de cierre que entiende el script: s = stop, t = take profit, m = manual, o = abierta. */
function letraMotivo(operacion: OperacionGuardada, clase: ClasificacionCierre | undefined): string {
  if (operacion.cierreUtc === null) return 'o';
  if (clase === 'tp') return 't';
  if (clase === 'sl') return 's';
  // Break even (o sin clasificar): se conserva el motivo original; el script decide el BE por el saldo.
  if (operacion.cierrePor === 'tp') return 't';
  if (operacion.cierrePor === 'sl') return 's';
  return 'm';
}

function numero(valor: number | null): string {
  if (valor === null) return '0';
  return valor.toFixed(5).replace(/0+$/, '').replace(/\.$/, '') || '0';
}

/** Una operación → 14 campos separados por coma (el orden lo lee leerOperacion en la plantilla). */
function codificar(operacion: OperacionGuardada, entrada: EntradaExportacion): string {
  const cierre = operacion.cierreUtc;
  const minutos = (utcMs: number) => Math.round(entrada.horas.desfaseMs(utcMs, operacion.importacionId) / MS_POR_MINUTO);
  return [
    operacion.ticket,
    operacion.tipo === 'compra' ? '1' : '0',
    numero(operacion.lotes),
    operacion.aperturaUtc,
    numero(operacion.precioEntrada),
    numero(operacion.stopLoss),
    numero(operacion.takeProfit),
    cierre ?? 0,
    numero(operacion.precioCierre),
    netoOperacion(operacion).toFixed(2),
    letraMotivo(operacion, entrada.analisis.clasificacion.get(operacion.id)),
    entrada.saldoEn(operacion.cuenta, operacion.aperturaUtc).toFixed(2),
    minutos(operacion.aperturaUtc),
    cierre === null ? 0 : minutos(cierre),
  ].join(',');
}

/** Agrupa textos de operación en cadenas de como máximo `tamano` caracteres. */
export function partirEnTrozos(textos: readonly string[], tamano: number): string[] {
  const trozos: string[] = [];
  let actual = '';
  for (const texto of textos) {
    if (actual !== '' && actual.length + texto.length + 1 > tamano) {
      trozos.push(actual);
      actual = '';
    }
    actual = actual === '' ? texto : `${actual};${texto}`;
  }
  if (actual !== '') trozos.push(actual);
  return trozos;
}

/** Reparte n elementos en partes casi iguales sin pasar de `maximo`. */
export function tamanosDePartes(n: number, maximo: number): number[] {
  const partes = Math.max(1, Math.ceil(n / maximo));
  const base = Math.floor(n / partes);
  const sobrantes = n % partes;
  return Array.from({ length: partes }, (_, i) => base + (i < sobrantes ? 1 : 0));
}

function sustituir(plantilla: string, valores: Readonly<Record<string, string>>): string {
  // split/join sustituye todas las apariciones sin interpretar caracteres especiales.
  return Object.entries(valores).reduce((codigo, [marca, valor]) => codigo.split(`@@${marca}@@`).join(valor), plantilla);
}

function nombreSeguro(texto: string): string {
  return texto.replace(/[^A-Za-z0-9_-]+/g, '_');
}

function crearScript(
  activo: string,
  simbolo: string,
  operaciones: readonly OperacionGuardada[],
  parte: number,
  partes: number,
  entrada: EntradaExportacion,
  parametros: ParametrosExportacion,
): ScriptPine {
  const textos = operaciones.map((o) => codificar(o, entrada));
  const trozos = partirEnTrozos(textos, parametros.tamanoTrozo);
  const lineasDatos = trozos.map((trozo, i) => `DATOS_${i + 1} = "${trozo}"`).join('\n');
  const nombresTrozos = trozos.map((_, i) => `DATOS_${i + 1}`).join(', ');
  const textoParte = partes > 1 ? `parte ${parte} de ${partes}` : 'completo';
  const codigo = sustituir(PLANTILLA_PINE, {
    SIMBOLO: simbolo.toUpperCase(),
    ACTIVO: activo,
    TOTAL: String(operaciones.length),
    PARTE: textoParte,
    PARTE_CORTA: partes > 1 ? `${parte}/${partes}` : 'operaciones',
    FILTROS: entrada.descripcionFiltros,
    ETIQUETA_HORA: entrada.horas.etiqueta,
    MAX_OPERACIONES: String(parametros.maximoOperacionesPorScript),
    PCT_BE: String(parametros.umbralBreakEvenPorcentaje),
    ANCHO_CAJA: String(parametros.anchoCajaBarras),
    DATOS: lineasDatos,
    NOMBRES_TROZOS: nombresTrozos,
  });
  const sufijo = partes > 1 ? `_parte${parte}de${partes}` : '';
  return {
    nombreFichero: `diario_${nombreSeguro(simbolo)}${sufijo}.pine`,
    activo,
    simboloTradingView: simbolo,
    parte,
    partes,
    operaciones: operaciones.length,
    codigo,
  };
}

/** Operaciones del filtro (cerradas y abiertas), ordenadas por apertura, agrupadas por activo. */
export function agruparPorActivo(analisis: AnalisisPeriodo): Map<string, OperacionGuardada[]> {
  const grupos = new Map<string, OperacionGuardada[]>();
  for (const operacion of [...analisis.operaciones, ...analisis.abiertas]) {
    grupos.set(operacion.activo, [...(grupos.get(operacion.activo) ?? []), operacion]);
  }
  for (const lista of grupos.values()) lista.sort((a, b) => a.aperturaUtc - b.aperturaUtc);
  return grupos;
}

export function generarScriptsPine(entrada: EntradaExportacion, parametros: ParametrosExportacion): ScriptPine[] {
  const scripts: ScriptPine[] = [];
  for (const [activo, operaciones] of [...agruparPorActivo(entrada.analisis)].sort(([a], [b]) => a.localeCompare(b))) {
    const simbolo = (entrada.simbolos[activo] ?? '').trim() || activo;
    const tamanos = tamanosDePartes(operaciones.length, parametros.maximoOperacionesPorScript);
    let inicio = 0;
    tamanos.forEach((tamano, i) => {
      scripts.push(crearScript(activo, simbolo, operaciones.slice(inicio, inicio + tamano), i + 1, tamanos.length, entrada, parametros));
      inicio += tamano;
    });
  }
  return scripts;
}

/** Texto corto de los filtros para la cabecera del script. */
export function describirFiltro(filtro: Filtro): string {
  const p = filtro.periodo;
  const periodo =
    p.tipo === 'total' ? 'todo el periodo'
    : p.tipo === 'anio' ? `año ${p.anio}`
    : p.tipo === 'trimestre' ? `T${p.trimestre} ${p.anio}`
    : p.tipo === 'mes' ? `mes ${p.mes}/${p.anio}`
    : `${p.desde} a ${p.hasta}`;
  return `${periodo}; activo ${filtro.activo ?? 'todos'}; cierre ${filtro.cierre ?? 'todos'}`;
}
