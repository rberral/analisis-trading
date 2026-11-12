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
  /** El fichero de las plataformas que entregan uno solo. */
  readonly fichero: File | null;
  /** Por tipo de informe, en las plataformas que entregan varios (Quantfury). */
  readonly ficheros: Readonly<Record<string, File | null>>;
  /** Texto escrito por el usuario; vacío si no lo indica. Solo informativo. */
  readonly apalancamiento: string;
  readonly broker: string;
  readonly cuenta: string;
  readonly moneda: string;
}

export interface VistaImportar {
  readonly elemento: HTMLElement;
  mostrarCargando(): void;
  /** Un resultado por fichero importado. `sinVelas`: operaciones cerradas de la cuenta que aún no tienen velas guardadas. */
  mostrarResultado(resultados: readonly ResultadoImportacion[], sinVelas: readonly OperacionesSinVelas[]): void;
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

function crearAvisos(resultado: ResultadoImportacion): HTMLElement[] {
  if (resultado.avisos.length === 0) return [];
  return [
    crearElemento('div', { class: 'aviso aviso--atencion' }, [
      crearElemento('strong', {}, ['Avisos']),
      crearElemento('ul', {}, resultado.avisos.map((aviso) => crearElemento('li', {}, [aviso]))),
    ]),
  ];
}

/** Un informe solo de movimientos (efectivo o trading de Quantfury) no tiene operaciones ni totales que comprobar. */
const soloMovimientos = (resultado: ResultadoImportacion): boolean =>
  resultado.nuevas + resultado.cerradasDesdeAbierta + resultado.yaExistentes + resultado.abiertas === 0;

function crearTarjetaResultado(resultado: ResultadoImportacion, primero: boolean): HTMLElement {
  const cabecera = crearElemento('h2', {}, [primero ? '2 · Resultado de la importación' : 'Fichero adicional']);
  const datosCuenta = crearElemento('p', { class: 'texto-suave' }, [`${resultado.nombreFichero} · ${resultado.broker} · ${resultado.cuenta} · ${resultado.moneda}`]);
  const apalancamiento = resultado.apalancamiento === null ? [] : [crearElemento('p', { class: 'texto-suave' }, [`Apalancamiento indicado: ${resultado.apalancamiento}:1 (solo informativo).`])];
  if (soloMovimientos(resultado)) {
    return crearElemento('div', { class: 'tarjeta' }, [
      cabecera,
      datosCuenta,
      crearElemento('div', { class: 'cifras' }, [crearTarjetaCifra(resultado.movimientos, 'ingresos, retiradas, dividendos y recompensas')]),
      ...(resultado.traeResumenCuenta ? [crearElemento('p', { class: 'texto-suave' }, ['Se ha guardado el saldo de la cuenta y las ganancias no realizadas (solo informativas): se ven en el Panel.'])] : []),
      ...apalancamiento,
      ...crearAvisos(resultado),
    ]);
  }
  return crearElemento('div', { class: 'tarjeta' }, [
    cabecera,
    datosCuenta,
    crearElemento('div', { class: 'cifras' }, [
      crearTarjetaCifra(resultado.nuevas, 'operaciones nuevas'),
      crearTarjetaCifra(resultado.cerradasDesdeAbierta, 'abiertas que ya se han cerrado'),
      crearTarjetaCifra(resultado.yaExistentes, 'ya existentes'),
      crearTarjetaCifra(resultado.abiertas, 'abiertas ahora (se guarda su SL y TP)'),
      crearTarjetaCifra(resultado.movimientos, 'ingresos, retiradas y dividendos'),
    ]),
    ...apalancamiento,
    crearElemento('h3', {}, ['Comprobación de totales contra el informe']),
    crearResumenValidacion(resultado),
    crearTablaComprobaciones(resultado.comprobaciones),
    ...crearAvisos(resultado),
  ]);
}

export function crearVistaImportar(opciones: OpcionesVista): VistaImportar {
  const selectorPlataforma = crearControl<HTMLSelectElement>('select', { name: 'plataforma' });
  for (const plataforma of opciones.plataformas) {
    selectorPlataforma.append(crearElemento('option', { value: plataforma.valor }, [plataforma.nombre]));
  }
  const campoFichero = crearControl<HTMLInputElement>('input', { type: 'file', name: 'fichero', accept: '.htm,.html' });
  // Plataformas con varios ficheros: un campo por fichero, con sus instrucciones de descarga.
  const camposFicheros = new Map<string, HTMLInputElement>();
  const zonaFicheros = crearElemento('div', { class: 'formulario', hidden: '' });
  for (const plataforma of opciones.plataformas) {
    for (const fichero of plataforma.ficheros ?? []) {
      if (camposFicheros.has(fichero.clave)) continue;
      const control = crearControl<HTMLInputElement>('input', { type: 'file', name: `fichero-${fichero.clave}`, accept: '.pdf' });
      camposFicheros.set(fichero.clave, control);
      zonaFicheros.append(campo(fichero.etiqueta, control), crearElemento('p', { class: 'texto-suave' }, [fichero.instrucciones]));
    }
  }
  const campoApalancamiento = crearControl<HTMLInputElement>('input', { type: 'text', name: 'apalancamiento', inputmode: 'decimal', placeholder: 'Por ejemplo 5 (5:1)' });
  const campoBrokerCuenta = crearCampoBrokerCuenta();
  const campoHorario = crearCampoHorario(opciones.horarios);
  const notaPlataforma = crearElemento('p', { class: 'texto-suave', hidden: '' });
  // Cada plataforma entrega un tipo de fichero, y algunas ya dan las horas en un huso fijo.
  const ajustarPlataforma = () => {
    const plataforma = opciones.plataformas.find((opcion) => opcion.valor === selectorPlataforma.value);
    campoFichero.accept = plataforma?.tipoFichero === 'pdf' ? '.pdf' : '.htm,.html';
    const variosFicheros = plataforma?.ficheros !== undefined;
    campoFichero.closest('label')!.hidden = variosFicheros;
    zonaFicheros.hidden = !variosFicheros;
    // Cada campo solo se ve si la plataforma elegida lo pide.
    for (const [clave, control] of camposFicheros) {
      const visible = plataforma?.ficheros?.some((fichero) => fichero.clave === clave) ?? false;
      control.closest('label')!.hidden = !visible;
      const instrucciones = control.closest('label')!.nextElementSibling as HTMLElement | null;
      if (instrucciones) instrucciones.hidden = !visible;
    }
    campoHorario.elemento.hidden = plataforma?.horarioFijo !== undefined;
    notaPlataforma.hidden = plataforma?.nota === undefined;
    notaPlataforma.replaceChildren(plataforma?.nota ?? '');
  };
  selectorPlataforma.addEventListener('change', ajustarPlataforma);

  const botonEnviar = crearControl<HTMLButtonElement>('button', { type: 'submit', class: 'boton' });
  botonEnviar.append('Importar y validar');

  const formulario = crearElemento('form', { class: 'tarjeta formulario', novalidate: '' }, [
    crearElemento('h2', {}, ['1 · Datos del fichero']),
    campo('Plataforma', selectorPlataforma),
    notaPlataforma,
    campo('Fichero del informe', campoFichero),
    zonaFicheros,
    campoBrokerCuenta.elemento,
    campo('Apalancamiento de la cuenta (opcional, solo informativo)', campoApalancamiento),
    campoHorario.elemento,
    crearElemento('p', { class: 'texto-suave' }, ['El fichero no se guarda: se lee, se importa y se descarta.']),
    botonEnviar,
  ]);

  // Los campos ya están dentro de su etiqueta: ahora se puede mostrar u ocultar cada uno.
  ajustarPlataforma();

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
      ficheros: Object.fromEntries([...camposFicheros].map(([clave, control]) => [clave, control.files?.[0] ?? null])),
      apalancamiento: campoApalancamiento.value,
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
    mostrarResultado(resultados, sinVelas) {
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
      zonaResultado.replaceChildren(...resultados.map((resultado, indice) => crearTarjetaResultado(resultado, indice === 0)), ...avisoVelas);
    },
  };
  return vista;
}
