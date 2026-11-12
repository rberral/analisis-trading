import type { OpcionModoHora } from '../config/app-config';
import type { ModoHora } from '../models/visualizacion';
import type { ScriptPine } from '../services/exportacion/generador-pine';
import { crearElemento } from './dom';
import { entero } from './formato';

export function crearSelectorHoras(modos: readonly OpcionModoHora[], actual: ModoHora, alCambiar: (modo: ModoHora) => void): HTMLElement {
  const selector = crearElemento('select', { name: 'Horas de las etiquetas', 'aria-label': 'Horas de las etiquetas' }) as HTMLSelectElement;
  for (const modo of modos) selector.append(crearElemento('option', { value: modo.id }, [modo.nombre]));
  selector.value = actual;
  selector.addEventListener('change', () => alCambiar(selector.value as ModoHora));
  return crearElemento('label', { class: 'campo campo--filtro' }, ['Horas de las etiquetas en TradingView', selector]);
}

/** Un campo por activo para indicar cómo se llama en TradingView (p. ej. SP500 → SPX). */
export function crearCamposSimbolos(
  activos: readonly string[],
  simbolos: Readonly<Record<string, string>>,
  alCambiar: (activo: string, simbolo: string) => void,
): HTMLElement {
  const campos = activos.map((activo) => {
    const campo = crearElemento('input', { type: 'text', name: `Símbolo de ${activo}`, value: simbolos[activo] ?? activo, maxlength: '30' }) as HTMLInputElement;
    campo.addEventListener('input', () => alCambiar(activo, campo.value));
    return crearElemento('label', { class: 'campo campo--filtro' }, [`${activo} en TradingView`, campo]);
  });
  return crearElemento('div', { class: 'tarjeta barra-filtros' }, [
    ...campos,
    crearElemento('p', { class: 'texto-suave barra-filtros__nota' }, [
      'Cada script solo dibuja si el nombre del gráfico de TradingView contiene este símbolo. Cámbialo si tu broker llama al activo de otra forma (por ejemplo SP500 en MetaTrader y SPX en TradingView).',
    ]),
  ]);
}

export function crearResultado(scripts: readonly ScriptPine[], alDescargar: (script: ScriptPine) => void): HTMLElement {
  if (scripts.length === 0) {
    return crearElemento('p', { class: 'aviso' }, ['Con estos filtros no hay operaciones que exportar.']);
  }
  const total = scripts.reduce((suma, s) => suma + s.operaciones, 0);
  const activos = new Set(scripts.map((s) => s.activo)).size;
  const filas = scripts.map((script) => {
    const boton = crearElemento('button', { type: 'button', class: 'boton' }, ['Descargar']);
    boton.addEventListener('click', () => alDescargar(script));
    const parte = script.partes > 1 ? ` · parte ${script.parte} de ${script.partes}` : '';
    return crearElemento('li', { class: 'fila-exportar' }, [
      crearElemento('span', {}, [`${script.simboloTradingView}${parte}: ${entero(script.operaciones)} operaciones (${script.nombreFichero}) `]),
      boton,
    ]);
  });
  const hayPartes = scripts.some((s) => s.partes > 1);
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Scripts generados']),
    crearElemento('p', {}, [`${entero(total)} operaciones en ${entero(scripts.length)} script${scripts.length === 1 ? '' : 's'} (${entero(activos)} activo${activos === 1 ? '' : 's'}).`]),
    ...(hayPartes
      ? [crearElemento('p', { class: 'aviso' }, ['Pine limita lo que se puede dibujar en un script, así que los activos con muchas operaciones se reparten en varias partes. Añade cada parte como un indicador distinto en el mismo gráfico, o acota los filtros (año, cierre) para necesitar menos.'])]
      : []),
    crearElemento('ul', { class: 'lista-exportar' }, filas),
  ]);
}

/** Botón que lanza el cálculo de los scripts; hasta pulsarlo no se genera nada. */
export function crearBotonGenerar(alPulsar: () => void): HTMLElement {
  const boton = crearElemento('button', { type: 'button', class: 'boton' }, ['Generar script']);
  boton.addEventListener('click', alPulsar);
  return crearElemento('div', { class: 'fila-exportar' }, [boton]);
}

export function crearManual(): HTMLElement {
  return crearElemento('details', { class: 'tarjeta nota-desplegable' }, [
    crearElemento('summary', {}, ['Cómo usar los scripts en TradingView']),
    crearElemento('ol', {}, [
      crearElemento('li', {}, ['Elige los filtros y pulsa «Generar script»; después descarga el script del activo (cada fichero es de un solo activo).']),
      crearElemento('li', {}, ['En TradingView abre el gráfico de ese activo y, abajo, el «Editor de Pine».']),
      crearElemento('li', {}, ['Borra el contenido, pega el script, y pulsa «Añadir al gráfico».']),
      crearElemento('li', {}, ['Si hay varias partes, repite el proceso con cada una: cada parte es un indicador distinto.']),
      crearElemento('li', {}, ['En los ajustes del indicador puedes filtrar por tipo de cierre, dirección y fechas, y cambiar el % de break even y los colores.']),
    ]),
    crearElemento('p', {}, [crearElemento('strong', {}, ['Horas: ']), 'el script lleva las horas en UTC absoluto, así que las operaciones siempre caen en su vela correcta. La hora que ves en el eje del gráfico la decide TradingView (clic derecho en el gráfico → Ajustes → Zona horaria); para ver el eje en hora de España, elígela ahí. La opción «Horas de las etiquetas» solo cambia los textos de las etiquetas al pasar el ratón.']),
    crearElemento('p', {}, [crearElemento('strong', {}, ['Precios: ']), 'los precios de entrada y salida son los de tu broker; el gráfico de TradingView viene de otro proveedor y puede diferir unos pips o puntos.']),
  ]);
}
