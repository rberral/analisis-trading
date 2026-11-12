import { claveCuenta, textoCuenta } from '../models/cuenta';
import type { AlcanceBorrado, ResumenDatos, ResultadoImportacionCopia } from '../services/copia/servicio-copia';
import { crearElemento } from './dom';
import { entero } from './formato';

/** Valor del desplegable de borrado para «solo las velas». */
const VELAS = '__velas__';

export function crearTarjetaResumen(resumen: ResumenDatos): HTMLElement {
  if (!resumen.hayDatos) {
    return crearElemento('section', { class: 'tarjeta' }, [
      crearElemento('h2', {}, ['Datos guardados']),
      crearElemento('p', {}, ['Todavía no hay datos guardados en este navegador.']),
    ]);
  }
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Datos guardados en este navegador']),
    crearElemento('p', {}, [`${entero(resumen.operaciones)} operaciones, ${entero(resumen.importaciones)} importaciones, ${entero(resumen.ventanasVelas)} ventanas de velas y ${entero(resumen.cargasVelas)} ficheros de velas cargados.`]),
    crearElemento('ul', {}, resumen.cuentas.map((c) => crearElemento('li', {}, [`${textoCuenta(c.cuenta)}: ${entero(c.operaciones)} operaciones`]))),
  ]);
}

export function crearTarjetaExportar(alExportar: (incluirVelas: boolean) => void): HTMLElement {
  const boton = crearElemento('button', { type: 'button', class: 'boton' }, ['Descargar copia de seguridad']);
  const casilla = crearElemento('input', { type: 'checkbox', name: 'Incluir velas', checked: '' }) as HTMLInputElement;
  boton.addEventListener('click', () => alExportar(casilla.checked));
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Exportar copia de seguridad']),
    crearElemento('p', {}, ['Descarga un fichero con todos tus datos (operaciones, importaciones, velas y brokers). Guárdalo en un sitio seguro.']),
    crearElemento('p', { class: 'texto-suave' }, ['Cada exportación descarga un fichero nuevo con la fecha en el nombre: el navegador no puede actualizar un fichero de tu disco por su cuenta. Quédate con el más reciente.']),
    crearElemento('label', { class: 'campo-casilla' }, [casilla, ' Incluir las velas guardadas']),
    crearElemento('p', { class: 'texto-suave' }, ['Las velas pueden hacer el fichero mucho más grande (decenas de megas con muchas operaciones). Sin ellas la copia es ligera, pero al restaurarla tendrás que volver a cargar los ficheros de velas para ver los gráficos.']),
    boton,
  ]);
}

export interface TarjetaImportar {
  readonly elemento: HTMLElement;
  mostrarResultado(resultado: ResultadoImportacionCopia): void;
  mostrarError(mensaje: string): void;
}

export function crearTarjetaImportar(alImportar: (fichero: File) => void): TarjetaImportar {
  const campo = crearElemento('input', { type: 'file', name: 'copia', accept: '.json,application/json' }) as HTMLInputElement;
  const boton = crearElemento('button', { type: 'button', class: 'boton' }, ['Importar copia']);
  const zona = crearElemento('div', { 'aria-live': 'polite' });
  boton.addEventListener('click', () => {
    const fichero = campo.files?.[0];
    if (!fichero) {
      zona.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['Elige el fichero de la copia.']));
      return;
    }
    alImportar(fichero);
  });
  const elemento = crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Importar copia de seguridad']),
    crearElemento('p', {}, ['Carga una copia descargada antes. Se fusiona con lo que ya tienes: no se borra nada, las operaciones que ya existen se actualizan y las nuevas se añaden (una operación ya cerrada nunca vuelve a abierta).']),
    crearElemento('label', { class: 'campo' }, ['Fichero de la copia', campo]),
    boton,
    zona,
  ]);
  return {
    elemento,
    mostrarResultado(resultado) {
      zona.replaceChildren(
        crearElemento('p', { class: 'aviso' }, [
          `Copia importada: ${entero(resultado.filas.operaciones)} operaciones en el fichero (${entero(resultado.operacionesNuevas)} nuevas), ${entero(resultado.filas.importaciones)} importaciones y ${entero(resultado.filas.ventanasVelas)} ventanas de velas.`,
        ]),
      );
    },
    mostrarError(mensaje) {
      zona.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, [mensaje]));
    },
  };
}

export function crearTarjetaBorrar(resumen: ResumenDatos, palabra: string, alBorrar: (alcance: AlcanceBorrado) => void, alExportar: () => void): HTMLElement {
  if (!resumen.hayDatos) {
    return crearElemento('section', { class: 'tarjeta' }, [crearElemento('h2', {}, ['Borrar datos']), crearElemento('p', {}, ['No hay datos que borrar.'])]);
  }
  const selector = crearElemento('select', { name: 'Qué borrar', 'aria-label': 'Qué borrar' }) as HTMLSelectElement;
  selector.append(crearElemento('option', { value: '' }, ['Todos los datos']));
  selector.append(crearElemento('option', { value: VELAS }, ['Solo las velas (ficheros cargados y velas de las operaciones)']));
  for (const c of resumen.cuentas) selector.append(crearElemento('option', { value: claveCuenta(c.cuenta) }, [`Solo ${textoCuenta(c.cuenta)}`]));

  const casillaVelas = crearElemento('input', { type: 'checkbox', name: 'Borrar también las velas' }) as HTMLInputElement;
  const filaVelas = crearElemento('label', { class: 'campo-casilla', hidden: '' }, [casillaVelas, ' Borrar también las velas de esas operaciones']);
  const notaVelas = crearElemento('p', { class: 'texto-suave', hidden: '' }, ['Si no marcas la casilla, las velas se conservan y, si reimportas esa misma cuenta, sus operaciones recuperan sus velas sin volver a cargar los ficheros. Ocupan espacio hasta que borres las velas.']);
  const campo = crearElemento('input', { type: 'text', name: 'confirmacion', autocomplete: 'off', placeholder: palabra }) as HTMLInputElement;
  const boton = crearElemento('button', { type: 'button', class: 'boton', disabled: '' }, ['Borrar definitivamente']) as HTMLButtonElement;
  selector.addEventListener('change', () => {
    const esCuenta = selector.value !== '' && selector.value !== VELAS;
    filaVelas.hidden = !esCuenta;
    notaVelas.hidden = !esCuenta;
  });
  campo.addEventListener('input', () => {
    boton.disabled = campo.value.trim() !== palabra;
  });
  boton.addEventListener('click', () => {
    if (campo.value.trim() !== palabra) return;
    const elegida = resumen.cuentas.find((c) => claveCuenta(c.cuenta) === selector.value);
    if (selector.value === VELAS) alBorrar({ tipo: 'velas' });
    else alBorrar(elegida ? { tipo: 'cuenta', cuenta: elegida.cuenta, borrarVelas: casillaVelas.checked } : { tipo: 'todo' });
  });
  const exportar = crearElemento('button', { type: 'button', class: 'boton' }, ['Descargar copia antes de borrar']);
  exportar.addEventListener('click', alExportar);

  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Borrar datos']),
    crearElemento('p', { class: 'aviso aviso--atencion' }, ['Esto elimina los datos guardados en este navegador y no se puede deshacer. Si quieres conservarlos, descarga antes una copia de seguridad.']),
    crearElemento('p', {}, ['Al borrar todo se eliminan operaciones, importaciones, velas (incluidos los ficheros de velas cargados) y brokers. «Solo las velas» borra únicamente las velas. Al borrar una cuenta se conservan las demás y, salvo que marques la casilla, también las velas (los ficheros de velas no pertenecen a un broker). Los ajustes de pantalla (como «Mostrar horas en») se mantienen.']),
    exportar,
    crearElemento('label', { class: 'campo campo--filtro' }, ['Qué borrar', selector]),
    filaVelas,
    notaVelas,
    crearElemento('label', { class: 'campo campo--filtro' }, [`Escribe ${palabra} para confirmar`, campo]),
    boton,
  ]);
}
