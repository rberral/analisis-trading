import type { OpcionTemporalidad } from '../config/app-config';
import type { RegistroCargaVelas, Temporalidad } from '../models/velas';
import type { AnalisisCargaVelas } from '../services/velas/servicio-velas';
import { crearElemento } from './dom';
import { entero, fechaHoraUtc, porcentaje } from './formato';
import { crearCampoHorario, type DatosHorario } from './horario-campo-view';

export interface DatosFormularioVelas extends DatosHorario {
  readonly activo: string;
  readonly temporalidad: Temporalidad;
  readonly fichero: File | null;
  readonly broker: string;
}

export interface VistaVelas {
  readonly elemento: HTMLElement;
  mostrarCargando(texto: string): void;
  mostrarError(mensaje: string): void;
  mostrarAnalisis(analisis: AnalisisCargaVelas): void;
  mostrarGuardado(registro: RegistroCargaVelas): void;
  mostrarCargas(cargas: readonly RegistroCargaVelas[]): void;
}

interface OpcionesVista {
  readonly temporalidades: readonly OpcionTemporalidad[];
  /** Activos de las operaciones ya importadas: se sugieren al escribir. */
  readonly activos: readonly string[];
  readonly alAnalizar: (datos: DatosFormularioVelas) => void;
  readonly alGuardar: () => void;
}

const campo = (etiqueta: string, control: HTMLElement) => crearElemento('label', { class: 'campo' }, [etiqueta, control]);

function crearTablaDesfases(analisis: AnalisisCargaVelas): HTMLElement {
  const filas = analisis.comprobacion.resultados.map((r) => {
    const esDeclarado = r.desfaseHoras === 0;
    const esMejor = r.desfaseHoras === analisis.comprobacion.mejorDesfaseHoras;
    const nombre = esDeclarado ? 'Horario indicado (0 h)' : `${r.desfaseHoras > 0 ? '+' : ''}${r.desfaseHoras} h`;
    return crearElemento('tr', esDeclarado ? { class: 'fila-destacada' } : {}, [
      crearElemento('td', {}, [nombre]),
      crearElemento('td', { class: 'numero' }, [`${r.encajan} de ${r.comprobados}`]),
      crearElemento('td', { class: 'numero' }, [r.porcentaje === null ? '—' : porcentaje(r.porcentaje)]),
      crearElemento('td', {}, [esMejor ? 'Mejor encaje' : '']),
    ]);
  });
  const cabecera = crearElemento('tr', {}, [
    crearElemento('th', {}, ['Desfase probado']),
    crearElemento('th', { class: 'numero' }, ['Precios dentro de su vela']),
    crearElemento('th', { class: 'numero' }, ['%']),
    crearElemento('th', {}, ['']),
  ]);
  return crearElemento('div', { class: 'tabla-envoltorio' }, [
    crearElemento('table', { class: 'tabla' }, [crearElemento('thead', {}, [cabecera]), crearElemento('tbody', {}, filas)]),
  ]);
}

function crearVeredicto(analisis: AnalisisCargaVelas): HTMLElement {
  const { veredicto, mejorDesfaseHoras } = analisis.comprobacion;
  if (veredicto === 'correcto') {
    return crearElemento('p', { class: 'aviso' }, ['El horario indicado encaja con los precios de tus operaciones.']);
  }
  if (veredicto === 'sospechoso') {
    const sugerencia =
      mejorDesfaseHoras !== null && mejorDesfaseHoras !== 0
        ? ` Encaja mejor con un desfase de ${mejorDesfaseHoras > 0 ? '+' : ''}${mejorDesfaseHoras} h. La aplicación no lo corrige sola: vuelve a cargar el fichero con el horario correcto.`
        : '';
    return crearElemento('p', { class: 'aviso aviso--atencion' }, [`El horario indicado NO encaja bien con los precios de tus operaciones.${sugerencia}`]);
  }
  return crearElemento('p', { class: 'aviso' }, [
    'No hay suficientes operaciones de este activo dentro del rango del fichero para comprobar el horario. Revísalo tú antes de guardar.',
  ]);
}

function crearTablaCargas(cargas: readonly RegistroCargaVelas[]): HTMLElement {
  if (cargas.length === 0) {
    return crearElemento('p', { class: 'texto-suave' }, ['Todavía no has cargado ningún fichero de velas.']);
  }
  const filas = cargas.map((c) =>
    crearElemento('tr', {}, [
      crearElemento('td', {}, [c.activo]),
      crearElemento('td', {}, [c.temporalidad]),
      crearElemento('td', {}, [c.nombreFichero]),
      crearElemento('td', {}, [c.broker ?? '—']),
      crearElemento('td', {}, [`${fechaHoraUtc(c.primeraVelaUtc)} → ${fechaHoraUtc(c.ultimaVelaUtc)}`]),
      crearElemento('td', { class: 'numero' }, [entero(c.ventanasGuardadas)]),
      crearElemento('td', {}, [fechaHoraUtc(c.fechaMs)]),
    ]),
  );
  const columnas = ['Activo', 'Temporalidad', 'Fichero', 'Broker', 'Rango (UTC)', 'Operaciones con velas', 'Cargado'];
  return crearElemento('div', { class: 'tabla-envoltorio' }, [
    crearElemento('table', { class: 'tabla' }, [
      crearElemento('thead', {}, [crearElemento('tr', {}, columnas.map((n) => crearElemento('th', {}, [n])))]),
      crearElemento('tbody', {}, filas),
    ]),
  ]);
}

export function crearVistaVelas(opciones: OpcionesVista): VistaVelas {
  const campoActivo = crearElemento('input', { type: 'text', name: 'activo', placeholder: 'EURUSD', list: 'activos-conocidos', autocomplete: 'off' }) as HTMLInputElement;
  const sugerencias = crearElemento('datalist', { id: 'activos-conocidos' }, opciones.activos.map((a) => crearElemento('option', { value: a })));
  const selectorTemporalidad = crearElemento('select', { name: 'temporalidad' }) as HTMLSelectElement;
  for (const t of opciones.temporalidades) selectorTemporalidad.append(crearElemento('option', { value: t.valor }, [t.nombre]));
  const campoFichero = crearElemento('input', { type: 'file', name: 'fichero', accept: '.csv,.txt' }) as HTMLInputElement;
  const campoBroker = crearElemento('input', { type: 'text', name: 'broker', placeholder: 'Nombre del broker' }) as HTMLInputElement;
  const campoHorario = crearCampoHorario();
  const botonAnalizar = crearElemento('button', { type: 'submit', class: 'boton' }, ['Analizar fichero']) as HTMLButtonElement;

  const formulario = crearElemento('form', { class: 'tarjeta formulario', novalidate: '' }, [
    crearElemento('h2', {}, ['1 · Datos del fichero de velas']),
    campo('Activo', campoActivo),
    sugerencias,
    campo('Temporalidad del fichero', selectorTemporalidad),
    campo('Fichero de velas (CSV de MetaTrader 4)', campoFichero),
    campo('Broker (opcional)', campoBroker),
    campoHorario.elemento,
    crearElemento('p', { class: 'texto-suave' }, ['El fichero no se guarda: solo se conservan las velas de cada una de tus operaciones.']),
    botonAnalizar,
  ]);
  formulario.addEventListener('submit', (evento) => {
    evento.preventDefault();
    opciones.alAnalizar({
      activo: campoActivo.value,
      temporalidad: selectorTemporalidad.value as Temporalidad,
      fichero: campoFichero.files?.[0] ?? null,
      broker: campoBroker.value,
      ...campoHorario.leer(),
    });
  });

  const zonaResultado = crearElemento('section', { class: 'resultado', 'aria-live': 'polite' });
  const zonaCargas = crearElemento('div', { class: 'tarjeta' });

  return {
    elemento: crearElemento('div', {}, [
      crearElemento('h1', { class: 'titulo-pagina' }, ['Velas y ficheros']),
      crearElemento('div', { class: 'dos-columnas' }, [formulario, zonaResultado]),
      crearElemento('h2', { class: 'subtitulo-pagina' }, ['Ficheros de velas cargados']),
      zonaCargas,
    ]),
    mostrarCargando(texto) {
      botonAnalizar.disabled = true;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'texto-suave' }, [texto]));
    },
    mostrarError(mensaje) {
      botonAnalizar.disabled = false;
      zonaResultado.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [mensaje]));
    },
    mostrarAnalisis(analisis) {
      botonAnalizar.disabled = false;
      const r = analisis.registro;
      const botonGuardar = crearElemento('button', { type: 'button', class: 'boton' }, ['Guardar velas de mis operaciones']) as HTMLButtonElement;
      botonGuardar.addEventListener('click', () => {
        botonGuardar.disabled = true;
        opciones.alGuardar();
      });
      const avisos = analisis.avisos.length
        ? [crearElemento('div', { class: 'aviso aviso--atencion' }, [crearElemento('strong', {}, ['Avisos']), crearElemento('ul', {}, analisis.avisos.map((a) => crearElemento('li', {}, [a])))])]
        : [];
      zonaResultado.replaceChildren(
        crearElemento('div', { class: 'tarjeta' }, [
          crearElemento('h2', {}, ['2 · Resultado del análisis']),
          crearElemento('p', { class: 'texto-suave' }, [`${r.nombreFichero} · ${r.activo} · ${r.temporalidad}`]),
          crearElemento('div', { class: 'cifras' }, [
            cifra(analisis.registro.velasLeidas, 'velas leídas'),
            cifra(analisis.operacionesDelActivo, `operaciones cerradas de ${r.activo}`),
            cifra(r.operacionesCubiertas, 'cubiertas por el fichero'),
            cifra(analisis.operacionesFueraDeRango, 'fuera del rango del fichero'),
            cifra(analisis.velasAGuardar, 'velas que se guardarían'),
          ]),
          crearElemento('p', { class: 'texto-suave' }, [`Rango del fichero (UTC): ${fechaHoraUtc(r.primeraVelaUtc)} → ${fechaHoraUtc(r.ultimaVelaUtc)}`]),
          crearElemento('h3', {}, ['Comprobación del horario']),
          crearVeredicto(analisis),
          crearTablaDesfases(analisis),
          ...avisos,
          botonGuardar,
        ]),
      );
    },
    mostrarGuardado(registro) {
      zonaResultado.replaceChildren(
        crearElemento('p', { class: 'aviso' }, [`Guardado: ${entero(registro.ventanasGuardadas)} operaciones de ${registro.activo} ya tienen sus velas.`]),
      );
    },
    mostrarCargas(cargas) {
      zonaCargas.replaceChildren(crearTablaCargas(cargas));
    },
  };
}

function cifra(valor: number, texto: string): HTMLElement {
  return crearElemento('div', { class: 'cifra' }, [crearElemento('div', { class: 'cifra__valor' }, [entero(valor)]), crearElemento('div', { class: 'cifra__texto' }, [texto])]);
}
