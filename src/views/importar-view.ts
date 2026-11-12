import { type OpcionHorario, type OpcionPlataforma } from '../config/app-config';
import type { Plataforma } from '../models/importacion';
import type { ResultadoImportacion } from '../services/importacion/importacion-service';
import type { Comprobacion } from '../services/importacion/validador-totales';
import { crearElemento } from './dom';
import { crearCampoHorario, type DatosHorario } from './horario-campo-view';

export interface DatosFormularioImportacion extends DatosHorario {
  readonly plataforma: Plataforma;
  readonly fichero: File | null;
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
}

export interface VistaImportar {
  readonly elemento: HTMLElement;
  mostrarCargando(): void;
  mostrarResultado(resultado: ResultadoImportacion): void;
  mostrarError(mensaje: string): void;
  /** Brokers y cuentas ya guardados, como sugerencias al escribir. */
  sugerir(brokers: readonly string[], cuentas: readonly string[]): void;
}

interface OpcionesVista {
  readonly plataformas: readonly OpcionPlataforma[];
  readonly horarios: readonly OpcionHorario[];
  readonly alEnviar: (datos: DatosFormularioImportacion) => void;
}

const formato = (decimales: number) =>
  new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

function campo(etiqueta: string, control: HTMLElement): HTMLElement {
  return crearElemento('label', { class: 'campo' }, [etiqueta, control]);
}

function crearControl<T extends HTMLElement>(etiqueta: string, atributos: Record<string, string>): T {
  return crearElemento(etiqueta, atributos) as T;
}

function crearTarjetaCifra(valor: number, texto: string): HTMLElement {
  return crearElemento('div', { class: 'cifra' }, [
    crearElemento('div', { class: 'cifra__valor' }, [formato(0).format(valor)]),
    crearElemento('div', { class: 'cifra__texto' }, [texto]),
  ]);
}

const TEXTO_ESTADO: Record<Comprobacion['estado'], string> = {
  coincide: 'Coincide',
  diferencia: 'Diferencia',
  no_disponible: 'No disponible',
};

function crearTablaComprobaciones(comprobaciones: readonly Comprobacion[]): HTMLElement {
  const filas = comprobaciones.map((comprobacion) => {
    const numero = formato(comprobacion.decimales);
    return crearElemento('tr', {}, [
      crearElemento('td', {}, [comprobacion.concepto]),
      crearElemento('td', { class: 'numero' }, [comprobacion.informe === null ? '—' : numero.format(comprobacion.informe)]),
      crearElemento('td', { class: 'numero' }, [numero.format(comprobacion.calculado)]),
      crearElemento('td', {}, [
        crearElemento('span', { class: `estado estado--${comprobacion.estado}` }, [TEXTO_ESTADO[comprobacion.estado]]),
      ]),
    ]);
  });
  const cabecera = crearElemento('tr', {}, [
    crearElemento('th', {}, ['Concepto']),
    crearElemento('th', { class: 'numero' }, ['Informe']),
    crearElemento('th', { class: 'numero' }, ['Calculado']),
    crearElemento('th', {}, ['Estado']),
  ]);
  return crearElemento('div', { class: 'tabla-envoltorio' }, [
    crearElemento('table', { class: 'tabla' }, [
      crearElemento('thead', {}, [cabecera]),
      crearElemento('tbody', {}, filas),
    ]),
  ]);
}

function crearResumenValidacion(resultado: ResultadoImportacion): HTMLElement {
  const hayDiferencias = resultado.comprobaciones.some((comprobacion) => comprobacion.estado === 'diferencia');
  const textoNoDisponible = resultado.tieneBloqueDetalle
    ? ''
    : ' Este informe no incluye el bloque de detalles: usa el informe detallado para validar más cifras.';
  const texto = hayDiferencias
    ? 'Hay cifras que no coinciden con las del informe. Revisa la tabla: puede faltar o sobrar alguna operación.'
    : `Todas las cifras que trae el informe coinciden con las recalculadas.${textoNoDisponible}`;
  return crearElemento('p', { class: hayDiferencias ? 'aviso aviso--atencion' : 'aviso' }, [texto]);
}

export function crearVistaImportar(opciones: OpcionesVista): VistaImportar {
  const selectorPlataforma = crearControl<HTMLSelectElement>('select', { name: 'plataforma' });
  for (const plataforma of opciones.plataformas) {
    selectorPlataforma.append(crearElemento('option', { value: plataforma.valor }, [plataforma.nombre]));
  }
  const campoFichero = crearControl<HTMLInputElement>('input', { type: 'file', name: 'fichero', accept: '.htm,.html' });
  const campoBroker = crearControl<HTMLInputElement>('input', { type: 'text', name: 'broker', placeholder: 'Por ejemplo: IC Markets', list: 'sugerencias-brokers', required: '', maxlength: '60' });
  const campoCuenta = crearControl<HTMLInputElement>('input', { type: 'text', name: 'cuenta', placeholder: 'Por defecto, el número de cuenta del informe', list: 'sugerencias-cuentas', maxlength: '60' });
  const campoMoneda = crearControl<HTMLInputElement>('input', { type: 'text', name: 'moneda', placeholder: 'Por defecto, la del informe (por ejemplo USD)', maxlength: '3' });
  const listaBrokers = crearElemento('datalist', { id: 'sugerencias-brokers' });
  const listaCuentas = crearElemento('datalist', { id: 'sugerencias-cuentas' });
  const campoHorario = crearCampoHorario(opciones.horarios);

  const botonEnviar = crearControl<HTMLButtonElement>('button', { type: 'submit', class: 'boton' });
  botonEnviar.append('Importar y validar');

  const formulario = crearElemento('form', { class: 'tarjeta formulario', novalidate: '' }, [
    crearElemento('h2', {}, ['1 · Datos del fichero']),
    campo('Plataforma', selectorPlataforma),
    campo('Fichero del informe', campoFichero),
    crearElemento('h3', {}, ['Broker y cuenta']),
    crearElemento('p', { class: 'aviso' }, [
      'Broker + cuenta identifican de dónde vienen tus datos, y cada combinación se analiza por separado (Panel, Operaciones, Errores y Exportar). Es importante porque cada cuenta puede usar una estrategia distinta: mezclarlas falsearía las estadísticas, el saldo, el drawdown, el break even y la detección de errores. Usa siempre exactamente el mismo broker y cuenta cuando importes informes nuevos de la misma cuenta; si cambias el nombre, se guardará como otra cuenta distinta.',
    ]),
    campo('Broker (obligatorio)', campoBroker),
    campo('Cuenta (opcional)', campoCuenta),
    campo('Moneda de la cuenta (opcional)', campoMoneda),
    crearElemento('p', { class: 'texto-suave' }, ['Los informes de MetaTrader traen la moneda (USD, EUR…) y se usa sola; solo escríbela si el informe no la incluye. Todos los importes de la cuenta están en esa moneda.']),
    listaBrokers,
    listaCuentas,
    campoHorario.elemento,
    crearElemento('p', { class: 'texto-suave' }, ['El fichero no se guarda: se lee, se importa y se descarta.']),
    botonEnviar,
  ]);

  const zonaResultado = crearElemento('section', { class: 'resultado', 'aria-live': 'polite' });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    opciones.alEnviar({
      plataforma: selectorPlataforma.value as Plataforma,
      fichero: campoFichero.files?.[0] ?? null,
      broker: campoBroker.value,
      cuenta: campoCuenta.value,
      moneda: campoMoneda.value,
      ...campoHorario.leer(),
    });
  });

  const elemento = crearElemento('div', { class: 'pagina-importar' }, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Importar operaciones']),
    crearElemento('div', { class: 'dos-columnas' }, [formulario, zonaResultado]),
  ]);

  return {
    elemento,
    sugerir(brokers, cuentas) {
      listaBrokers.replaceChildren(...brokers.map((b) => crearElemento('option', { value: b })));
      listaCuentas.replaceChildren(...cuentas.map((c) => crearElemento('option', { value: c })));
    },
    mostrarCargando() {
      botonEnviar.disabled = true;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'texto-suave' }, ['Importando…']));
    },
    mostrarError(mensaje) {
      botonEnviar.disabled = false;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [mensaje]));
    },
    mostrarResultado(resultado) {
      botonEnviar.disabled = false;
      const avisos = resultado.avisos.length
        ? [
            crearElemento('div', { class: 'aviso aviso--atencion' }, [
              crearElemento('strong', {}, ['Avisos']),
              crearElemento('ul', {}, resultado.avisos.map((aviso) => crearElemento('li', {}, [aviso]))),
            ]),
          ]
        : [];
      zonaResultado.replaceChildren(
        crearElemento('div', { class: 'tarjeta' }, [
          crearElemento('h2', {}, ['2 · Resultado de la importación']),
          crearElemento('p', { class: 'texto-suave' }, [`${resultado.nombreFichero} · ${resultado.broker} · ${resultado.cuenta} · ${resultado.moneda}`]),
          crearElemento('div', { class: 'cifras' }, [
            crearTarjetaCifra(resultado.nuevas, 'operaciones nuevas'),
            crearTarjetaCifra(resultado.cerradasDesdeAbierta, 'abiertas que ya se han cerrado'),
            crearTarjetaCifra(resultado.yaExistentes, 'ya existentes'),
            crearTarjetaCifra(resultado.abiertas, 'abiertas ahora (se guarda su SL y TP)'),
            crearTarjetaCifra(resultado.movimientos, 'ingresos, retiradas y dividendos'),
          ]),
          crearElemento('h3', {}, ['Comprobación de totales contra el informe']),
          crearResumenValidacion(resultado),
          crearTablaComprobaciones(resultado.comprobaciones),
          ...avisos,
        ]),
      );
    },
  };
}
