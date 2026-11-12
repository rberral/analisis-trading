import { type OpcionHorario, type OpcionPlataforma } from '../config/app-config';
import type { Plataforma } from '../models/importacion';
import type { ResultadoImportacion } from '../services/importacion/importacion-service';
import type { Comprobacion } from '../services/importacion/validador-totales';
import { crearElemento } from './dom';
import { crearCampoBrokerCuenta } from './broker-cuenta-campo-view';
import type { CuentaConMoneda } from '../services/consultas/cuentas';
import type { OperacionesSinVelas } from '../services/velas/cobertura';
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
  /** `sinVelas`: operaciones cerradas de la cuenta que aún no tienen velas guardadas. */
  mostrarResultado(resultado: ResultadoImportacion, sinVelas: readonly OperacionesSinVelas[]): void;
  mostrarError(mensaje: string): void;
  /** Pide un cambio fijo por moneda cuando no se han podido obtener los cambios automáticos. */
  pedirCambios(mensaje: string, monedas: readonly string[], destino: string, alConfirmar: (cambios: Readonly<Record<string, string>>) => void): void;
  /** Cuentas ya guardadas, para poder elegirlas en los desplegables. */
  cargarCuentas(cuentas: readonly CuentaConMoneda[]): void;
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
  const campoBrokerCuenta = crearCampoBrokerCuenta();
  const campoHorario = crearCampoHorario(opciones.horarios);
  const notaPlataforma = crearElemento('p', { class: 'texto-suave', hidden: '' });
  // Cada plataforma entrega un tipo de fichero, y algunas ya dan las horas en un huso fijo.
  const ajustarPlataforma = () => {
    const plataforma = opciones.plataformas.find((opcion) => opcion.valor === selectorPlataforma.value);
    campoFichero.accept = plataforma?.tipoFichero === 'pdf' ? '.pdf' : '.htm,.html';
    campoHorario.elemento.hidden = plataforma?.horarioFijo !== undefined;
    notaPlataforma.hidden = plataforma?.nota === undefined;
    notaPlataforma.replaceChildren(plataforma?.nota ?? '');
  };
  selectorPlataforma.addEventListener('change', ajustarPlataforma);
  ajustarPlataforma();

  const botonEnviar = crearControl<HTMLButtonElement>('button', { type: 'submit', class: 'boton' });
  botonEnviar.append('Importar y validar');

  const formulario = crearElemento('form', { class: 'tarjeta formulario', novalidate: '' }, [
    crearElemento('h2', {}, ['1 · Datos del fichero']),
    campo('Plataforma', selectorPlataforma),
    notaPlataforma,
    campo('Fichero del informe', campoFichero),
    campoBrokerCuenta.elemento,
    campoHorario.elemento,
    crearElemento('p', { class: 'texto-suave' }, ['El fichero no se guarda: se lee, se importa y se descarta.']),
    botonEnviar,
  ]);

  const zonaResultado = crearElemento('section', { class: 'resultado', 'aria-live': 'polite' });

  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    const errorBroker = campoBrokerCuenta.validar();
    if (errorBroker) {
      vista.mostrarError(errorBroker);
      return;
    }
    opciones.alEnviar({
      plataforma: selectorPlataforma.value as Plataforma,
      fichero: campoFichero.files?.[0] ?? null,
      ...campoBrokerCuenta.leer(),
      ...campoHorario.leer(),
    });
  });

  const elemento = crearElemento('div', { class: 'pagina-importar' }, [
    crearElemento('h1', { class: 'titulo-pagina' }, ['Importar operaciones']),
    crearElemento('div', { class: 'dos-columnas' }, [formulario, zonaResultado]),
  ]);

  const vista: VistaImportar = {
    elemento,
    cargarCuentas: (cuentas) => campoBrokerCuenta.cargar(cuentas),
    mostrarCargando() {
      botonEnviar.disabled = true;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'texto-suave' }, ['Importando…']));
    },
    pedirCambios(mensaje, monedas, destino, alConfirmar) {
      botonEnviar.disabled = false;
      const campos = monedas.map((moneda) => ({
        moneda,
        control: crearControl<HTMLInputElement>('input', { type: 'text', name: `Cambio ${moneda}`, inputmode: 'decimal', 'aria-label': `1 ${moneda} en ${destino}` }),
      }));
      const boton = crearControl<HTMLButtonElement>('button', { type: 'button', class: 'boton' });
      boton.append('Importar con estos cambios');
      boton.addEventListener('click', () => alConfirmar(Object.fromEntries(campos.map(({ moneda, control }) => [moneda, control.value]))));
      zonaResultado.replaceChildren(
        crearElemento('div', { class: 'tarjeta' }, [
          crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [mensaje]),
          ...campos.map(({ moneda, control }) => campo(`1 ${moneda} = … ${destino}`, control)),
          boton,
        ]),
      );
    },
    mostrarError(mensaje) {
      botonEnviar.disabled = false;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [mensaje]));
    },
    mostrarResultado(resultado, sinVelas) {
      botonEnviar.disabled = false;
      const avisoVelas = sinVelas.length
        ? [
            crearElemento('div', { class: 'aviso aviso--atencion' }, [
              crearElemento('strong', {}, ['Operaciones sin velas']),
              crearElemento('p', {}, [
                `Estas operaciones cerradas no tienen velas guardadas, así que su detalle no mostrará el gráfico: ${sinVelas.map((s) => `${s.activo} (${formato(0).format(s.cantidad)})`).join(', ')}. Para verlo, vuelve a cargar el histórico de velas de cada activo en `,
                crearElemento('a', { href: '#/velas', class: 'enlace' }, ['Velas y ficheros']),
                '. Las velas solo se guardan para las operaciones que ya existen al cargar el fichero.',
              ]),
            ]),
          ]
        : [];
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
          ...avisoVelas,
        ]),
      );
    },
  };
  return vista;
}
