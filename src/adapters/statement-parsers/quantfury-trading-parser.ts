/**
 * Lector del «Estado de la cuenta de trading» de Quantfury. Aporta lo que el historial no trae:
 * los dividendos (con su hora), las recompensas y los ingresos/retiradas de cada año (sin hora),
 * más el saldo de la cuenta y las ganancias no realizadas en la fecha del informe.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { InformeParseado } from '../../models/informe';
import type { MovimientoInforme } from '../../models/operacion';
import { fechaEscrita, horaIso, importeDe, marcaDeHora, pegarSimbolos, redondear2 } from './quantfury-comun';

const GENERADO = /^Generado:\s*(\d{1,2}\s+\S+\s+\d{4}),\s*(\d{1,2}):(\d{2}):(\d{2})\s*(AM|PM)\s*UTC/;
const PERIODO = /^(\d{1,2}\s+\S+\s+\d{4})\s+[–-]\s+(\d{1,2}\s+\S+\s+\d{4})$/;
const DIVIDENDO = new RegExp(
  '^(\\S+)\\s+(\\d{2})/(\\d{2})/(\\d{4})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})\\s+(AM|PM)\\s+UTC\\s+(?:LARGO|CORTO)\\s+.*?([+-]?[$€¥£₮][\\d,]+\\.\\d+)\\s*$',
);
const FILA_TIPO_ACTIVO = /^(?:Acciones|ETFs|Pares de criptomonedas|Futuros de índices|Futuros de materias|Pares de divisas)\s+\d+\s+\d+\s+(N\/A|[+-]\$[\d,]+\.\d+)\s/;
const IMPORTE_DOLARES = '.*?(-?\\$[\\d,]+\\.\\d+)\\s*$';

interface Seccion {
  readonly fin: string;
  saldo: number | null;
  depositos: number;
  retiros: number;
  recompensas: number;
  noRealizadas: number;
}

const dolares = (linea: string, etiqueta: RegExp): number | null => {
  if (!etiqueta.test(linea)) return null;
  const importe = new RegExp(IMPORTE_DOLARES).exec(linea)?.[1];
  return importe === undefined ? null : importeDe(importe).importe;
};

export function leerEstadoTrading(texto: string): InformeParseado {
  const movimientos: MovimientoInforme[] = [];
  const secciones: Seccion[] = [];
  const usados = new Set<string>();
  let generado: { fecha: string; hora: string } | null = null;
  let nombre = '';
  let informacionDeCuenta = false;

  for (const linea of texto.split(/\r?\n/)) {
    const limpia = pegarSimbolos(linea.trim());
    const cliente = /^Nombre del cliente:\s*(.+)$/.exec(limpia);
    if (cliente) nombre = cliente[1]!.trim();
    const fechaGenerado = GENERADO.exec(limpia);
    if (fechaGenerado) {
      const fecha = fechaEscrita(fechaGenerado[1]!);
      if (fecha) generado = { fecha, hora: horaIso(fecha.slice(8), fecha.slice(5, 7), fecha.slice(0, 4), fechaGenerado[2]!, fechaGenerado[3]!, fechaGenerado[4]!, fechaGenerado[5]!) };
    }
    if (limpia === 'Información de la cuenta') informacionDeCuenta = true;
    if (!informacionDeCuenta) continue;

    const periodo = PERIODO.exec(limpia);
    if (periodo) {
      secciones.push({ fin: fechaEscrita(periodo[2]!) ?? '', saldo: null, depositos: 0, retiros: 0, recompensas: 0, noRealizadas: 0 });
      continue;
    }
    const actual = secciones[secciones.length - 1];
    if (!actual) continue;

    const saldo = dolares(limpia, /^Saldo (?:final )?de la cuenta de trading\b/);
    if (saldo !== null) actual.saldo = saldo;
    actual.depositos += dolares(limpia, /^Depósitos\b/) ?? 0;
    actual.retiros += dolares(limpia, /^Retiros\b/) ?? 0;
    actual.recompensas += dolares(limpia, /^Recompensas\b/) ?? 0;
    const noRealizadas = FILA_TIPO_ACTIVO.exec(limpia)?.[1];
    if (noRealizadas !== undefined && noRealizadas !== 'N/A') actual.noRealizadas += importeDe(noRealizadas).importe;

    const dividendo = DIVIDENDO.exec(limpia);
    if (dividendo) {
      const [, simbolo, dia, mes, anio, hora, minuto, segundo, ampm, pago] = dividendo as unknown as string[];
      const horaBroker = horaIso(dia!, mes!, anio!, hora!, minuto!, segundo!, ampm!);
      const { importe, moneda } = importeDe(pago!);
      let ticket = `DIVIDENDO-${simbolo!.toUpperCase()}-${marcaDeHora(horaBroker)}`;
      for (let n = 2; usados.has(ticket); n++) ticket = `DIVIDENDO-${simbolo!.toUpperCase()}-${marcaDeHora(horaBroker)}-${n}`;
      usados.add(ticket);
      movimientos.push({ ticket, horaBroker, descripcion: `Dividendo ${simbolo}`, importe, clase: 'dividendo', monedaOrigen: moneda });
    }
  }

  if (secciones.length === 0 || generado === null) {
    throw new ErrorDeUsuario('El PDF no parece un estado de la cuenta de trading de Quantfury.');
  }
  // La hora de cierre de cada periodo: el último segundo del año, o la del propio informe si el periodo sigue abierto.
  const finDelPeriodo = (seccion: Seccion): string => (seccion.fin === generado.fecha ? generado.hora : `${seccion.fin}T23:59:59`);
  for (const seccion of secciones) {
    const anio = seccion.fin.slice(0, 4);
    const neto = redondear2(seccion.depositos - seccion.retiros);
    if (neto !== 0) {
      movimientos.push({ ticket: `ANUAL-${anio}`, horaBroker: finDelPeriodo(seccion), descripcion: `Ingresos menos retiradas de ${anio}`, importe: neto, clase: 'anual', monedaOrigen: 'USD' });
    }
    if (seccion.recompensas !== 0) {
      movimientos.push({ ticket: `RECOMPENSAS-${anio}`, horaBroker: finDelPeriodo(seccion), descripcion: `Recompensas de ${anio}`, importe: seccion.recompensas, clase: 'recompensa', monedaOrigen: 'USD' });
    }
  }

  const reciente = secciones[0]!;
  const tieneResumen = reciente.saldo !== null && reciente.fin === generado.fecha;
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
    ...(tieneResumen ? { resumenCuenta: { horaBroker: generado.hora, patrimonio: reciente.saldo!, noRealizadas: redondear2(reciente.noRealizadas) } } : {}),
    avisos: tieneResumen ? [] : ['No se ha encontrado el saldo actual en el estado de trading: no se podrá mostrar el saldo de la cuenta.'],
  };
}

