import { type OpcionPlataforma } from '../config/app-config';
import type { Plataforma } from '../models/importacion';
import type { ResultadoImportacion } from '../services/importacion/importacion-service';
import type { Comprobacion } from '../services/importacion/validador-totales';
import { crearElemento } from './dom';

export interface DatosFormularioImportacion {
  readonly plataforma: Plataforma;
  readonly fichero: File | null;
  readonly broker: string;
  readonly tipoHorario: 'zona' | 'nueva_york_mas' | null;
  readonly zona: string;
  readonly horas: string;
}

export interface VistaImportar {
  readonly elemento: HTMLElement;
  mostrarCargando(): void;
  mostrarResultado(resultado: ResultadoImportacion): void;
  mostrarError(mensaje: string): void;
}

interface OpcionesVista {
  readonly plataformas: readonly OpcionPlataforma[];
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

function crearOpcionHorario(valor: string, texto: string, control: HTMLElement): HTMLElement {
  const radio = crearElemento('input', { type: 'radio', name: 'horario', value: valor });
  return crearElemento('div', { class: 'opcion-horario' }, [
    crearElemento('label', { class: 'opcion-horario__radio' }, [radio, texto]),
    control,
  ]);
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
  const campoBroker = crearControl<HTMLInputElement>('input', { type: 'text', name: 'broker', placeholder: 'Nombre del broker' });
  const campoZona = crearControl<HTMLInputElement>('input', {
    type: 'text',
    name: 'zona',
    placeholder: 'Europe/Athens',
    'aria-label': 'Nombre de la zona horaria',
  });
  const campoHoras = crearControl<HTMLInputElement>('input', {
    type: 'number',
    name: 'horas',
    step: '1',
    placeholder: '7',
    'aria-label': 'Horas de diferencia con Nueva York',
  });
  const opcionZona = crearOpcionHorario('zona', 'Zona horaria con nombre', campoZona);
  const opcionNuevaYork = crearOpcionHorario('nueva_york_mas', 'Regla «Nueva York + N horas»', campoHoras);

  const botonEnviar = crearControl<HTMLButtonElement>('button', { type: 'submit', class: 'boton' });
  botonEnviar.append('Importar y validar');

  const formulario = crearElemento('form', { class: 'tarjeta formulario', novalidate: '' }, [
    crearElemento('h2', {}, ['1 · Datos del fichero']),
    campo('Plataforma', selectorPlataforma),
    campo('Fichero del informe', campoFichero),
    campo('Broker (opcional)', campoBroker),
    crearElemento('fieldset', { class: 'grupo' }, [
      crearElemento('legend', {}, ['Horario del servidor del broker (obligatorio)']),
      opcionZona,
      opcionNuevaYork,
      crearElemento('p', { class: 'texto-suave' }, [
        'No hay valor por defecto: el informe no incluye la zona horaria y la aplicación no la deduce.',
      ]),
    ]),
    crearElemento('p', { class: 'texto-suave' }, ['El fichero no se guarda: se lee, se importa y se descarta.']),
    botonEnviar,
  ]);

  const zonaResultado = crearElemento('section', { class: 'resultado', 'aria-live': 'polite' });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const seleccionado = formulario.querySelector<HTMLInputElement>('input[name="horario"]:checked');
    opciones.alEnviar({
      plataforma: selectorPlataforma.value as Plataforma,
      fichero: campoFichero.files?.[0] ?? null,
      broker: campoBroker.value,
      tipoHorario: seleccionado ? (seleccionado.value as 'zona' | 'nueva_york_mas') : null,
      zona: campoZona.value,
      horas: campoHoras.value,
    });
  });

  const elemento = crearElemento('div', { class: 'pagina-importar' }, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Importar operaciones']),
    crearElemento('div', { class: 'dos-columnas' }, [formulario, zonaResultado]),
  ]);

  return {
    elemento,
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
          crearElemento('p', { class: 'texto-suave' }, [`${resultado.nombreFichero} · cuenta ${resultado.cuenta}`]),
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
