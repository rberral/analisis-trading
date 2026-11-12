/**
 * Lector del texto del informe PDF de Quantfury («Informe del historial de trading»).
 *
 * Quantfury no habla de operaciones sueltas sino de posiciones: una apertura, cero o más
 * ampliaciones o reducciones y un cierre, seguidas de una fila «Total». Cada posición pasa a
 * ser una operación. Recibe el texto ya extraído del PDF (una línea por fila de tabla);
 * de extraerlo se encarga otro adaptador, así este código se prueba sin PDF.
 */
import { ErrorDeUsuario } from '../../core/errores';
import type { InformeParseado } from '../../models/informe';
import type { OperacionInforme } from '../../models/operacion';
import type { ParserInforme } from '../../services/importacion/puertos';

type Accion = 'abrir' | 'añadir' | 'reducir' | 'cerrar';

/** Una fila de la tabla: un movimiento dentro de una posición. */
interface FilaPosicion {
  readonly simbolo: string;
  readonly hora: string;
  readonly esCompra: boolean;
  readonly accion: Accion;
  readonly precio: number;
  /** Cantidad del activo; en divisas y futuros el informe solo da el valor, y se deduce de él. */
  readonly cantidad: number;
  /** Resultado de la fila (solo al reducir o cerrar) y su moneda. */
  readonly resultado: { readonly importe: number; readonly moneda: string } | null;
}

const SIMBOLOS_MONEDA: Readonly<Record<string, string>> = { $: 'USD', '€': 'EUR', '¥': 'JPY', '£': 'GBP', '₮': 'USDT' };
const CLASE_SIMBOLO = '[$€¥£₮]';
const TOLERANCIA_TOTAL = 0.011;
const FILA = new RegExp(
  '^(\\S+)\\s+(\\d{2})/(\\d{2})/(\\d{4})\\s+(\\d{1,2}):(\\d{2}):(\\d{2})\\s+(AM|PM)\\s+UTC\\s+(COMPRAR|VENDER)\\s+\\((abrir|añadir|reducir|cerrar)\\)\\s+(.+)$',
);
const TOTAL = new RegExp(`^Total\\s+([+-]?\\s*${CLASE_SIMBOLO}?\\s*[\\d,]+\\.\\d+)\\s*$`);

function importeDe(texto: string): { importe: number; moneda: string } {
  const limpio = texto.replace(/\s+/g, '');
  const simbolo = new RegExp(CLASE_SIMBOLO).exec(limpio)?.[0] ?? '';
  const moneda = SIMBOLOS_MONEDA[simbolo];
  if (moneda === undefined) throw new ErrorDeUsuario(`Moneda no reconocida en «${texto}». Quantfury usa $, €, ¥ o ₮ en los informes.`);
  const numero = Number(limpio.replace(new RegExp(CLASE_SIMBOLO), '').replace(/[+,]/g, ''));
  if (!Number.isFinite(numero)) throw new ErrorDeUsuario(`No se entiende el importe «${texto}».`);
  return { importe: numero, moneda };
}

function numeroDe(texto: string): number {
  const numero = Number(texto.replace(new RegExp(CLASE_SIMBOLO, 'g'), '').replace(/,/g, ''));
  if (!Number.isFinite(numero)) throw new ErrorDeUsuario(`No se entiende el número «${texto}».`);
  return numero;
}

/** El PDF separa a veces el símbolo de la moneda del número («- $ 7.70»): se pega para tratarlo como un solo trozo. */
function pegarSimbolos(texto: string): string {
  return texto
    .replace(new RegExp(`([+-])\\s+(?=${CLASE_SIMBOLO})`, 'g'), '$1')
    .replace(new RegExp(`(${CLASE_SIMBOLO})\\s+(?=\\d)`, 'g'), '$1');
}

function horaIso(dia: string, mes: string, anio: string, hora: string, minuto: string, segundo: string, ampm: string): string {
  const base = Number(hora) % 12;
  const hora24 = ampm === 'PM' ? base + 12 : base;
  return `${anio}-${mes}-${dia}T${String(hora24).padStart(2, '0')}:${minuto}:${segundo}`;
}

/** Interpreta una línea como fila de posición, o devuelve null si es otra cosa (títulos, pies de página…). */
function leerFila(linea: string): FilaPosicion | null {
  const coincidencia = FILA.exec(linea.trim());
  if (!coincidencia) return null;
  const [, simbolo, dia, mes, anio, hora, minuto, segundo, ampm, sentido, accion, resto] = coincidencia as unknown as string[];
  const trozos = pegarSimbolos(resto!).split(/\s+/);
  const precio = numeroDe(trozos[0] ?? '');
  // Con cantidad: precio, cantidad, unidad, valor[, resultado]. Sin ella (divisas, futuros): precio, valor[, resultado].
  const conCantidad = /^[A-Za-z]/.test(trozos[2] ?? '');
  const valor = numeroDe(trozos[conCantidad ? 3 : 1] ?? '');
  const textoResultado = trozos[conCantidad ? 4 : 2];
  const cantidad = conCantidad ? numeroDe(trozos[1] ?? '') : precio > 0 ? valor / precio : 0;
  return {
    simbolo: simbolo!.replace('/', '').toUpperCase(),
    hora: horaIso(dia!, mes!, anio!, hora!, minuto!, segundo!, ampm!),
    esCompra: sentido === 'COMPRAR',
    accion: accion as Accion,
    precio,
    cantidad,
    resultado: textoResultado === undefined ? null : importeDe(textoResultado),
  };
}

const sumar = (valores: readonly number[]): number => valores.reduce((suma, valor) => suma + valor, 0);

function precioMedio(filas: readonly FilaPosicion[]): number {
  const cantidad = sumar(filas.map((fila) => fila.cantidad));
  return cantidad > 0 ? sumar(filas.map((fila) => fila.precio * fila.cantidad)) / cantidad : (filas[0]?.precio ?? 0);
}

/** "2026-06-26T13:33:33" -> "20260626133333": sirve de identificador, porque Quantfury no numera las posiciones. */
const marcaDeHora = (hora: string): string => hora.replace(/[-:T]/g, '');

function crearOperacion(filas: readonly FilaPosicion[], total: { importe: number; moneda: string } | null, cerrada: boolean, ticket: string): OperacionInforme {
  const primera = filas[0]!;
  const entradas = filas.filter((fila) => fila.accion === 'abrir' || fila.accion === 'añadir');
  const salidas = filas.filter((fila) => fila.accion === 'reducir' || fila.accion === 'cerrar');
  const resultados = filas.flatMap((fila) => (fila.resultado ? [fila.resultado] : []));
  const resultado = total ?? (resultados.length > 0 ? { importe: sumar(resultados.map((r) => r.importe)), moneda: resultados[0]!.moneda } : null);
  return {
    ticket,
    tipo: primera.esCompra ? 'compra' : 'venta',
    lotes: sumar(entradas.map((fila) => fila.cantidad)),
    activo: primera.simbolo,
    precioEntrada: precioMedio(entradas),
    stopLoss: null,
    takeProfit: null,
    aperturaBroker: primera.hora,
    cierreBroker: cerrada ? filas[filas.length - 1]!.hora : null,
    precioCierre: cerrada && salidas.length > 0 ? precioMedio(salidas) : null,
    precioActual: null,
    comision: 0,
    impuestos: 0,
    swap: 0,
    beneficio: resultado?.importe ?? 0,
    comentario: '',
    cierrePor: cerrada ? 'manual' : null,
    sinNivelesDeRiesgo: true,
    ...(resultado ? { monedaOrigen: resultado.moneda } : {}),
  };
}

export function leerInformeQuantfury(texto: string): InformeParseado {
  const lineas = texto.split(/\r?\n/);
  const cerradas: OperacionInforme[] = [];
  const abiertas: OperacionInforme[] = [];
  const avisos: string[] = [];
  const usados = new Set<string>();
  let nombre = '';
  let enCerradas = false;
  let hayCabeceras = false;
  let grupo: FilaPosicion[] = [];
  let sumaTotales = 0;
  let totalesLeidos = 0;

  const ticketNuevo = (fila: FilaPosicion): string => {
    const base = `${fila.simbolo}-${marcaDeHora(fila.hora)}`;
    let ticket = base;
    for (let n = 2; usados.has(ticket); n++) ticket = `${base}-${n}`;
    usados.add(ticket);
    return ticket;
  };

  /** Cierra el grupo de filas en curso: es una posición abierta (sin total) o cerrada (con total). */
  const terminarGrupo = (total: { importe: number; moneda: string } | null): void => {
    if (grupo.length === 0) return;
    const ticket = ticketNuevo(grupo[0]!);
    const cerrada = enCerradas;
    if (cerrada && total) {
      const filas = sumar(grupo.flatMap((fila) => (fila.resultado ? [fila.resultado.importe] : [])));
      if (Math.abs(filas - total.importe) > TOLERANCIA_TOTAL) {
        avisos.push(`La posición ${ticket} no cuadra: sus filas suman ${filas.toFixed(2)} y el informe indica ${total.importe.toFixed(2)}.`);
      }
    }
    (cerrada ? cerradas : abiertas).push(crearOperacion(grupo, total, cerrada, ticket));
    grupo = [];
  };

  for (const linea of lineas) {
    const limpia = linea.trim();
    const cliente = /^Nombre del cliente:\s*(.+)$/.exec(limpia);
    if (cliente) nombre = cliente[1]!.trim();
    if (/^Posiciones Abiertas/.test(limpia)) {
      hayCabeceras = true;
      terminarGrupo(null);
      enCerradas = false;
      continue;
    }
    if (/^Posiciones Cerradas/.test(limpia)) {
      hayCabeceras = true;
      terminarGrupo(null);
      enCerradas = true;
      continue;
    }
    const fila = leerFila(limpia);
    if (fila) {
      // En posiciones abiertas no hay total: una nueva apertura marca el comienzo de otra posición.
      if (!enCerradas && fila.accion === 'abrir') terminarGrupo(null);
      grupo.push(fila);
      continue;
    }
    const total = TOTAL.exec(pegarSimbolos(limpia));
    if (total && enCerradas) {
      const importe = importeDe(total[1]!);
      sumaTotales += importe.importe;
      totalesLeidos++;
      terminarGrupo(importe);
    }
  }
  terminarGrupo(null);

  if (!hayCabeceras) {
    throw new ErrorDeUsuario('El PDF no parece un informe de historial de Quantfury (no se encuentran «Posiciones Abiertas» ni «Posiciones Cerradas»).');
  }
  return {
    cuenta: 'Principal',
    nombre,
    // Quantfury mezcla monedas en un mismo informe: la de la cuenta la elige el usuario al importar.
    moneda: '',
    cerradas,
    abiertas,
    movimientos: [],
    totales: { totalOperaciones: totalesLeidos, beneficioNeto: Math.round(sumaTotales * 100) / 100, resultadoCerrado: Math.round(sumaTotales * 100) / 100 },
    tieneBloqueDetalle: false,
    avisos,
  };
}

export class ParserQuantfury implements ParserInforme {
  leer(contenido: string): InformeParseado {
    return leerInformeQuantfury(contenido);
  }
}
