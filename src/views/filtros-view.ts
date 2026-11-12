import type { ClasificacionCierre, Filtro, Periodo } from '../models/filtro';
import { TEXTO_CLASIFICACION } from '../services/analisis/clasificacion-cierre';
import type { OpcionesDelFiltro } from '../services/consultas/analisis-periodo';
import { crearElemento } from './dom';

interface OpcionesBarra {
  readonly opciones: OpcionesDelFiltro;
  readonly filtro: Filtro;
  readonly alCambiar: (filtro: Filtro) => void;
}

type TipoPeriodo = Periodo['tipo'];

const NOMBRES_PERIODO: ReadonlyArray<readonly [TipoPeriodo, string]> = [
  ['total', 'Total'],
  ['anio', 'Año'],
  ['trimestre', 'Trimestre'],
  ['mes', 'Mes'],
  ['rango', 'Rango de fechas'],
];

const NOMBRES_MES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

function selector(nombre: string, opciones: ReadonlyArray<readonly [string, string]>, valor: string): HTMLSelectElement {
  const control = crearElemento('select', { name: nombre, 'aria-label': nombre }) as HTMLSelectElement;
  for (const [valorOpcion, texto] of opciones) {
    control.append(crearElemento('option', { value: valorOpcion }, [texto]));
  }
  control.value = valor;
  return control;
}

function etiquetado(texto: string, control: HTMLElement): HTMLElement {
  return crearElemento('label', { class: 'campo campo--filtro' }, [texto, control]);
}

function periodoPorDefecto(tipo: TipoPeriodo, anios: readonly number[], anterior: Periodo): Periodo {
  const anio = 'anio' in anterior ? anterior.anio : (anios[0] ?? new Date().getUTCFullYear());
  switch (tipo) {
    case 'total':
      return { tipo };
    case 'anio':
      return { tipo, anio };
    case 'trimestre':
      return { tipo, anio, trimestre: 'trimestre' in anterior ? anterior.trimestre : 1 };
    case 'mes':
      return { tipo, anio, mes: 'mes' in anterior ? anterior.mes : 1 };
    case 'rango':
      return { tipo, desde: 'desde' in anterior ? anterior.desde : '', hasta: 'hasta' in anterior ? anterior.hasta : '' };
  }
}

/** Barra de filtros: periodo, activo y (si hay varias) cuenta. Se redibuja sola al cambiar el tipo de periodo. */
export function crearBarraFiltros(opciones: OpcionesBarra): HTMLElement {
  const barra = crearElemento('form', { class: 'tarjeta barra-filtros', novalidate: '' });

  function dibujar(filtro: Filtro): void {
    const periodo = filtro.periodo;
    const selectorTipo = selector('Periodo', NOMBRES_PERIODO.map(([v, t]) => [v, t]), periodo.tipo);
    const campos: HTMLElement[] = [etiquetado('Periodo', selectorTipo)];
    const leer: Array<() => Partial<Periodo>> = [];

    const aniosOpcion = opciones.opciones.anios.map((a): [string, string] => [String(a), String(a)]);
    if ('anio' in periodo) {
      const control = selector('Año', aniosOpcion, String(periodo.anio));
      campos.push(etiquetado('Año', control));
      leer.push(() => ({ anio: Number(control.value) }));
    }
    if (periodo.tipo === 'trimestre') {
      const control = selector('Trimestre', [['1', 'T1'], ['2', 'T2'], ['3', 'T3'], ['4', 'T4']], String(periodo.trimestre));
      campos.push(etiquetado('Trimestre', control));
      leer.push(() => ({ trimestre: Number(control.value) as 1 | 2 | 3 | 4 }));
    }
    if (periodo.tipo === 'mes') {
      const control = selector('Mes', NOMBRES_MES.map((n, i): [string, string] => [String(i + 1), n]), String(periodo.mes));
      campos.push(etiquetado('Mes', control));
      leer.push(() => ({ mes: Number(control.value) }));
    }
    if (periodo.tipo === 'rango') {
      const desde = crearElemento('input', { type: 'date', name: 'desde', value: periodo.desde }) as HTMLInputElement;
      const hasta = crearElemento('input', { type: 'date', name: 'hasta', value: periodo.hasta }) as HTMLInputElement;
      campos.push(etiquetado('Desde', desde), etiquetado('Hasta', hasta));
      leer.push(() => ({ desde: desde.value, hasta: hasta.value }));
    }

    const selectorActivo = selector('Activo', [['', 'Todos los activos'], ...opciones.opciones.activos.map((a): [string, string] => [a, a])], filtro.activo ?? '');
    campos.push(etiquetado('Activo', selectorActivo));

    const selectorCierre = selector('Cierre', [['', 'Todos los cierres'], ...(Object.keys(TEXTO_CLASIFICACION) as ClasificacionCierre[]).map((c): [string, string] => [c, TEXTO_CLASIFICACION[c]])], filtro.cierre ?? '');
    campos.push(etiquetado('Cierre', selectorCierre));

    const selectorCuenta = selector('Cuenta', [['', 'Todas las cuentas'], ...opciones.opciones.cuentas.map((c): [string, string] => [c, c])], filtro.cuenta ?? '');
    if (opciones.opciones.cuentas.length > 1) campos.push(etiquetado('Cuenta', selectorCuenta));

    selectorTipo.addEventListener('change', () => {
      const nuevo: Filtro = {
        periodo: periodoPorDefecto(selectorTipo.value as TipoPeriodo, opciones.opciones.anios, periodo),
        activo: selectorActivo.value || null,
        cuenta: selectorCuenta.value || null,
        cierre: (selectorCierre.value || null) as ClasificacionCierre | null,
      };
      dibujar(nuevo);
      opciones.alCambiar(nuevo);
    });

    const alCambiarOtro = () => {
      const detalles = Object.assign({}, ...leer.map((funcion) => funcion())) as Partial<Periodo>;
      opciones.alCambiar({
        periodo: { ...periodo, ...detalles } as Periodo,
        activo: selectorActivo.value || null,
        cuenta: selectorCuenta.value || null,
        cierre: (selectorCierre.value || null) as ClasificacionCierre | null,
      });
    };
    // Cada control reacciona a su propio cambio; el selector de tipo ya tiene su manejador.
    for (const campo of campos.slice(1)) {
      campo.querySelector('select,input')?.addEventListener('change', alCambiarOtro);
    }

    campos.push(crearElemento('p', { class: 'texto-suave barra-filtros__nota' }, ['Los periodos (año, trimestre, mes y rango) se cuentan en UTC, según la hora de cierre de cada operación.']));
    barra.replaceChildren(...campos);
  }

  dibujar(opciones.filtro);
  barra.addEventListener('submit', (evento) => evento.preventDefault());
  return barra;
}
