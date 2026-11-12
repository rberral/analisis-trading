/**
 * Importación de un informe: lo lee, convierte las horas a UTC, comprueba los
 * totales y guarda solo lo que todavía no estaba guardado.
 */
import { ErrorDeUsuario } from '../../core/errores';
import { convertirHoraBrokerAUtc, validarHorario, type EstadoHora, type HorarioBroker } from '../../core/horario';
import { logger } from '../../core/logger';
import type { InformeParseado } from '../../models/informe';
import type {
  InstantaneaAbierta,
  MovimientoGuardado,
  Plataforma,
  RegistroImportacion,
} from '../../models/importacion';
import type { OperacionGuardada, OperacionInforme } from '../../models/operacion';
import { calcularEstadisticas } from '../estadisticas/calculadora-estadisticas';
import { convertirMovimientos, convertirOperaciones, type ProveedorTasasHistoricas } from './conversion-moneda';
import type { ParserInforme, RepositorioOperaciones } from './puertos';
import { calcularBalanceInicial, validarTotales, type Comprobacion } from './validador-totales';

export interface OpcionesImportacion {
  readonly plataforma: Plataforma;
  readonly nombreFichero: string;
  /** Obligatorio. Broker y cuenta identifican de dónde vienen los datos. */
  readonly broker: string;
  /** Nombre de la cuenta; si va vacío se usa el número de cuenta del informe. */
  readonly cuenta: string;
  /** Moneda de la cuenta; si va vacía se usa la que trae el informe. */
  readonly moneda: string;
  readonly horario: HorarioBroker;
  /** Solo si el informe mezcla monedas: cambio fijo por moneda (unidades de la moneda de la cuenta por cada una). */
  readonly cambiosManuales?: Readonly<Record<string, number>>;
  /** Apalancamiento de la cuenta, solo para mostrarlo: ningún cálculo lo usa. */
  readonly apalancamiento?: number | null;
}

export interface ResultadoImportacion {
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
  readonly nombreFichero: string;
  readonly nuevas: number;
  /** Operaciones que estaban abiertas en una importación anterior y ahora figuran cerradas. */
  readonly cerradasDesdeAbierta: number;
  readonly yaExistentes: number;
  readonly abiertas: number;
  readonly movimientos: number;
  readonly tieneBloqueDetalle: boolean;
  readonly comprobaciones: readonly Comprobacion[];
  readonly avisos: readonly string[];
  /** Operaciones cuyo resultado se ha convertido a la moneda de la cuenta. */
  readonly convertidas: number;
  readonly apalancamiento: number | null;
  /** true si el informe trae el saldo de la cuenta en su fecha (estado de trading de Quantfury). */
  readonly traeResumenCuenta: boolean;
}

/** Cómo se parecen entre sí las monedas del informe y las que admite el proveedor de cambios. */
export interface ConfiguracionConversion {
  readonly proveedor: ProveedorTasasHistoricas | null;
  readonly equivalencias: Readonly<Record<string, string>>;
}

const TEXTO_ESTADO_HORA: Record<Exclude<EstadoHora, 'normal'>, string> = {
  ambigua: 'ocurre dos veces por un cambio de hora; se ha usado la primera',
  inexistente: 'no existe por un cambio de hora; se ha ajustado hacia delante',
};

export class ServicioImportacion {
  constructor(
    private readonly parsers: Readonly<Record<Plataforma, ParserInforme>>,
    private readonly repositorio: RepositorioOperaciones,
    private readonly conversion: ConfiguracionConversion = { proveedor: null, equivalencias: {} },
  ) {}

  async importar(contenido: string, opciones: OpcionesImportacion): Promise<ResultadoImportacion> {
    const broker = opciones.broker.trim();
    if (broker === '') throw new ErrorDeUsuario('Indica el broker: separa los datos de cada broker y cuenta.');
    const errorHorario = validarHorario(opciones.horario);
    if (errorHorario) throw new ErrorDeUsuario(errorHorario);

    const apalancamiento = opciones.apalancamiento ?? null;
    if (apalancamiento !== null && !(Number.isFinite(apalancamiento) && apalancamiento > 0)) {
      throw new ErrorDeUsuario('El apalancamiento debe ser un número mayor que cero (por ejemplo 5 si es 5:1), o dejarse vacío.');
    }
    const informe = this.parsers[opciones.plataforma].leer(contenido);
    if (informe.cerradas.length === 0 && informe.abiertas.length === 0 && informe.movimientos.length === 0 && !informe.resumenCuenta) {
      throw new ErrorDeUsuario('El informe no contiene ninguna operación ni movimiento.');
    }

    const importacionId = crypto.randomUUID();
    const avisos: string[] = [];
    const aUtc = (hora: string, descripcion: string): number => {
      const convertida = convertirHoraBrokerAUtc(hora, opciones.horario);
      if (convertida.estado !== 'normal') {
        avisos.push(`La hora ${hora.replace('T', ' ')} (${descripcion}) ${TEXTO_ESTADO_HORA[convertida.estado]}.`);
      }
      return convertida.utcMs;
    };

    const cuenta = opciones.cuenta.trim() || informe.cuenta;
    const moneda = (opciones.moneda.trim() || informe.moneda).toUpperCase();
    if (!/^[A-Z]{3}$/.test(moneda)) {
      throw new ErrorDeUsuario('Indica la moneda de la cuenta con 3 letras (por ejemplo USD o EUR): el informe no la trae.');
    }
    if (informe.monedaObligatoria !== undefined && moneda !== informe.monedaObligatoria) {
      throw new ErrorDeUsuario(`Este informe de Quantfury está en ${informe.monedaObligatoria}: la cuenta debe ser en ${informe.monedaObligatoria}, no en ${moneda}.`);
    }
    const monedaGuardada = await this.repositorio.monedaDeCuenta(broker, cuenta);
    if (monedaGuardada !== null && monedaGuardada !== '' && monedaGuardada !== moneda) {
      throw new ErrorDeUsuario(`La cuenta ${broker} · ${cuenta} ya está guardada en ${monedaGuardada} y este informe es en ${moneda}. Revisa el nombre de la cuenta o la moneda.`);
    }
    const propietaria = { broker, cuenta, moneda };
    const parametrosCambio = {
      monedaCuenta: moneda,
      equivalencias: this.conversion.equivalencias,
      cambiosManuales: opciones.cambiosManuales ?? {},
      proveedor: this.conversion.proveedor,
    };
    const convertido = await convertirOperaciones([...informe.cerradas, ...informe.abiertas], parametrosCambio);
    if (convertido.convertidas > 0) {
      avisos.push(
        `${convertido.convertidas} operaciones en ${convertido.monedasConvertidas.join(', ')} se han convertido a ${moneda}; se guarda también el importe original. Las cifras de la tabla de comprobación se comparan con los importes originales, sin convertir.`,
      );
    }
    const conversionMovimientos = await convertirMovimientos(informe.movimientos, parametrosCambio);
    if (conversionMovimientos.convertidos > 0) {
      avisos.push(`${conversionMovimientos.convertidos} movimientos en otra moneda (dividendos) se han convertido a ${moneda} con el cambio del día; se guarda también el importe original.`);
    }
    avisos.push(...(informe.avisos ?? []));
    const operaciones = convertido.operaciones.map((operacion) => aOperacionGuardada(operacion, propietaria, importacionId, aUtc));
    const movimientos: MovimientoGuardado[] = conversionMovimientos.movimientos.map((movimiento, indice) => {
      const original = informe.movimientos[indice]!;
      const convertido = movimiento.importe !== original.importe;
      return {
        id: `${broker}:${cuenta}:${movimiento.ticket}`,
        broker,
        cuenta,
        moneda,
        ticket: movimiento.ticket,
        descripcion: movimiento.descripcion,
        importe: movimiento.importe,
        horaBroker: movimiento.horaBroker,
        utcMs: aUtc(movimiento.horaBroker, `movimiento ${movimiento.ticket}`),
        importacionId,
        ...(movimiento.clase ? { clase: movimiento.clase } : {}),
        ...(convertido && movimiento.monedaOrigen ? { importeOrigen: original.importe, monedaOrigen: movimiento.monedaOrigen } : {}),
      };
    });
    const resumenCuenta = informe.resumenCuenta
      ? { fechaUtcMs: aUtc(informe.resumenCuenta.horaBroker, 'fecha del estado de la cuenta'), patrimonio: informe.resumenCuenta.patrimonio, noRealizadas: informe.resumenCuenta.noRealizadas }
      : null;

    const estados = await this.repositorio.estadoDeOperaciones(operaciones.map((operacion) => operacion.id));
    let nuevas = 0;
    let cerradasDesdeAbierta = 0;
    let yaExistentes = 0;
    const aGuardar: OperacionGuardada[] = [];
    for (const operacion of operaciones) {
      const estado = estados.get(operacion.id);
      if (estado === 'cerrada') {
        yaExistentes++;
        continue;
      }
      if (estado === undefined) nuevas++;
      else if (operacion.cierreUtc !== null) cerradasDesdeAbierta++;
      else yaExistentes++;
      // Las abiertas que ya existían también se guardan: su SL, TP y precio pueden haber cambiado.
      aGuardar.push(operacion);
    }

    const comprobaciones = comprobarTotales(informe);
    const fechaMs = Date.now();
    const importacion: RegistroImportacion = {
      id: importacionId,
      broker,
      cuenta,
      moneda,
      plataforma: opciones.plataforma,
      nombreFichero: opciones.nombreFichero,
      horario: opciones.horario,
      fechaMs,
      nuevas,
      cerradasDesdeAbierta,
      yaExistentes,
      abiertas: informe.abiertas.length,
      validacionCorrecta: comprobaciones.every((comprobacion) => comprobacion.estado !== 'diferencia'),
      ...(apalancamiento !== null ? { apalancamiento } : {}),
      ...(resumenCuenta ? { resumenCuenta } : {}),
    };
    const instantaneas = operaciones
      .filter((operacion) => operacion.cierreUtc === null)
      .map((operacion): InstantaneaAbierta => ({
        id: `${importacionId}:${operacion.ticket}`,
        importacionId,
        broker,
        cuenta,
        ticket: operacion.ticket,
        fechaMs,
        stopLoss: operacion.stopLoss,
        takeProfit: operacion.takeProfit,
        precioActual: operacion.precioActual,
      }));

    await this.repositorio.guardarImportacion({ importacion, operaciones: aGuardar, movimientos, instantaneas });
    logger.info(`Importación terminada: ${nuevas} nuevas, ${yaExistentes} ya existentes`);

    return {
      broker,
      cuenta,
      moneda,
      nombreFichero: opciones.nombreFichero,
      nuevas,
      cerradasDesdeAbierta,
      yaExistentes,
      abiertas: informe.abiertas.length,
      movimientos: movimientos.length,
      tieneBloqueDetalle: informe.tieneBloqueDetalle,
      comprobaciones,
      avisos,
      convertidas: convertido.convertidas,
      apalancamiento,
      traeResumenCuenta: resumenCuenta !== null,
    };
  }
}

function comprobarTotales(informe: InformeParseado): Comprobacion[] {
  // Un informe de solo movimientos (efectivo o trading de Quantfury) no tiene operaciones que comprobar.
  if (informe.cerradas.length === 0 && informe.abiertas.length === 0) return [];
  const estadisticas = calcularEstadisticas(
    informe.cerradas.map((operacion) => ({ ...operacion, cierre: operacion.cierreBroker ?? '' })),
    calcularBalanceInicial(informe),
  );
  return validarTotales(informe, estadisticas);
}

function aOperacionGuardada(
  operacion: OperacionInforme,
  propietaria: { readonly broker: string; readonly cuenta: string; readonly moneda: string },
  importacionId: string,
  aUtc: (hora: string, descripcion: string) => number,
): OperacionGuardada {
  return {
    ...operacion,
    id: `${propietaria.broker}:${propietaria.cuenta}:${operacion.ticket}`,
    broker: propietaria.broker,
    cuenta: propietaria.cuenta,
    moneda: propietaria.moneda,
    aperturaUtc: aUtc(operacion.aperturaBroker, `apertura de ${operacion.ticket}`),
    cierreUtc:
      operacion.cierreBroker === null ? null : aUtc(operacion.cierreBroker, `cierre de ${operacion.ticket}`),
    importacionId,
  };
}
