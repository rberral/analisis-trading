/**
 * Lector del «Estado de la cuenta en efectivo» de Quantfury. De él solo interesan los traspasos entre la
 * cuenta en efectivo y la de trading, que son los ingresos y retiradas reales de la cuenta que se analiza.
 * Cada traspaso trae su hora, y su valor en dólares.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { InformeParseado } from '../../models/informe';
import type { MovimientoInforme } from '../../models/operacion';
import { horaIso, marcaDeHora, numeroDe, pegarSimbolos, redondear2, sumar } from './quantfury-comun';

const TRASPASO = new RegExp(
  '^(\\d{2})/(\\d{2})/(\\d{4})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})\\s+(AM|PM)\\s+UTC\\s+Transfer(?:ir|encia)\\s+(a|desde)\\s+la cuenta de trading\\s+.*?\\$\\s*([\\d,]+\\.\\d+)\\s*$',
);
const PERIODO = /^\d{1,2}\s+\S+\s+\d{4}\s+[–-]\s+\d{1,2}\s+\S+\s+(\d{4})$/;
const TOTAL_ANUAL = /^Transferencias\s+(hacia|desde)\s+la cuenta de trading\b.*?\$\s*([\d,]+\.\d+)\s*$/;
/** Margen al comparar los traspasos de un año con el total que da el propio informe. */
const TOLERANCIA_ANUAL = 0.5;

interface TotalesDelAnio {
  hacia?: number;
  desde?: number;
}

export function leerEstadoEfectivo(texto: string): InformeParseado {
  const movimientos: MovimientoInforme[] = [];
  const usados = new Set<string>();
  const totales = new Map<number, TotalesDelAnio>();
  let anioDelTotal: number | null = null;
  let nombre = '';
  let informacionDeCuenta = false;

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = pegarSimbolos(linea.trim());
    const cliente = /^Nombre del cliente:\s*(.+)$/.exec(limpia);
    if (cliente) nombre = cliente[1]!.trim();
    if (limpia === 'Información de la cuenta') informacionDeCuenta = true;

    const periodo = informacionDeCuenta ? PERIODO.exec(limpia) : null;
    if (periodo) {
      anioDelTotal = Number(periodo[1]);
      continue;
    }
    const total = TOTAL_ANUAL.exec(limpia);
    if (total && anioDelTotal !== null) {
      const delAnio = totales.get(anioDelTotal) ?? {};
      delAnio[total[1] === 'hacia' ? 'hacia' : 'desde'] = numeroDe(total[2]!);
      totales.set(anioDelTotal, delAnio);
      continue;
    }

    const fila = TRASPASO.exec(limpia);
    if (!fila) continue;
    const [, dia, mes, anio, hora, minuto, segundo, ampm, sentido, valor] = fila as unknown as string[];
    const horaBroker = horaIso(dia!, mes!, anio!, hora!, minuto!, segundo!, ampm!);
    let ticket = `TRASPASO-${marcaDeHora(horaBroker)}`;
    for (let n = 2; usados.has(ticket); n++) ticket = `TRASPASO-${marcaDeHora(horaBroker)}-${n}`;
    usados.add(ticket);
    const entra = sentido === 'a';
    movimientos.push({
      ticket,
      horaBroker,
      descripcion: entra ? 'Traspaso a la cuenta de trading' : 'Traspaso desde la cuenta de trading',
      importe: (entra ? 1 : -1) * numeroDe(valor!),
      clase: 'traspaso',
      monedaOrigen: 'USD',
    });
  }

  if (!informacionDeCuenta) {
    throw new ErrorDeUsuario('El PDF no parece un estado de la cuenta en efectivo de Quantfury.');
  }
  return {
    cuenta: 'Principal',
    nombre,
    moneda: 'USD',
    monedaObligatoria: 'USD',
    cerradas: [],
    abiertas: [],
    movimientos,
    totales: {},
    tieneBloqueDetalle: false,
    avisos: comprobarTotalesAnuales(movimientos, totales),
  };
}

/** Los traspasos de cada año deben sumar lo que el informe dice para ese año; si no, falta alguna fila. */
function comprobarTotalesAnuales(movimientos: readonly MovimientoInforme[], totales: ReadonlyMap<number, TotalesDelAnio>): string[] {
  const avisos: string[] = [];
  for (const [anio, esperado] of totales) {
    const delAnio = movimientos.filter((m) => m.horaBroker.startsWith(String(anio)));
    const entradas = sumar(delAnio.filter((m) => m.importe > 0).map((m) => m.importe));
    const salidas = -sumar(delAnio.filter((m) => m.importe < 0).map((m) => m.importe));
    const diferencias: Array<[string, number, number | undefined]> = [
      ['hacia', entradas, esperado.hacia],
      ['desde', salidas, esperado.desde],
    ];
    for (const [sentido, leido, indicado] of diferencias) {
      if (indicado !== undefined && Math.abs(leido - indicado) > TOLERANCIA_ANUAL) {
        avisos.push(`Traspasos ${sentido} la cuenta de trading de ${anio}: las filas suman ${redondear2(leido).toFixed(2)} y el informe indica ${indicado.toFixed(2)}.`);
      }
    }
  }
  return avisos;
}
