import { claveCuenta, textoCuenta } from '../models/cuenta';
import type { AlcanceBorrado, ResumenDatos, ResultadoImportacionCopia } from '../services/copia/servicio-copia';
import { crearElemento } from './dom';
import { entero } from './formato';

export function crearTarjetaResumen(resumen: ResumenDatos): HTMLElement {
  if (resumen.operaciones === 0) {
    return crearElemento('section', { class: 'tarjeta' }, [
      crearElemento('h2', {}, ['Datos guardados']),
      crearElemento('p', {}, ['Todavía no hay datos guardados en este navegador.']),
    ]);
  }
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Datos guardados en este navegador']),
    crearElemento('p', {}, [`${entero(resumen.operaciones)} operaciones, ${entero(resumen.importaciones)} importaciones y ${entero(resumen.ventanasVelas)} ventanas de velas.`]),
    crearElemento('ul', {}, resumen.cuentas.map((c) => crearElemento('li', {}, [`${textoCuenta(c.cuenta)}: ${entero(c.operaciones)} operaciones`]))),
  ]);
}

export function crearTarjetaExportar(alExportar: () => void): HTMLElement {
  const boton = crearElemento('button', { type: 'button', class: 'boton' }, ['Descargar copia de seguridad']);
  boton.addEventListener('click', alExportar);
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Exportar copia de seguridad']),
    crearElemento('p', {}, ['Descarga un fichero con todos tus datos (operaciones, importaciones, velas y brokers). Guárdalo en un sitio seguro.']),
    crearElemento('p', { class: 'texto-suave' }, ['Cada exportación descarga un fichero nuevo con la fecha en el nombre: el navegador no puede actualizar un fichero de tu disco por su cuenta. Quédate con el más reciente.']),
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
  if (resumen.operaciones === 0) {
    return crearElemento('section', { class: 'tarjeta' }, [crearElemento('h2', {}, ['Borrar datos']), crearElemento('p', {}, ['No hay datos que borrar.'])]);
  }
  const selector = crearElemento('select', { name: 'Qué borrar', 'aria-label': 'Qué borrar' }) as HTMLSelectElement;
  selector.append(crearElemento('option', { value: '' }, ['Todos los datos']));
  for (const c of resumen.cuentas) selector.append(crearElemento('option', { value: claveCuenta(c.cuenta) }, [`Solo ${textoCuenta(c.cuenta)}`]));

  const campo = crearElemento('input', { type: 'text', name: 'confirmacion', autocomplete: 'off', placeholder: palabra }) as HTMLInputElement;
  const boton = crearElemento('button', { type: 'button', class: 'boton', disabled: '' }, ['Borrar definitivamente']) as HTMLButtonElement;
  campo.addEventListener('input', () => {
    boton.disabled = campo.value.trim() !== palabra;
  });
  boton.addEventListener('click', () => {
    if (campo.value.trim() !== palabra) return;
    const elegida = resumen.cuentas.find((c) => claveCuenta(c.cuenta) === selector.value);
    alBorrar(elegida ? { tipo: 'cuenta', cuenta: elegida.cuenta } : { tipo: 'todo' });
  });
  const exportar = crearElemento('button', { type: 'button', class: 'boton' }, ['Descargar copia antes de borrar']);
  exportar.addEventListener('click', alExportar);

  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Borrar datos']),
    crearElemento('p', { class: 'aviso aviso--atencion' }, ['Esto elimina los datos guardados en este navegador y no se puede deshacer. Si quieres conservarlos, descarga antes una copia de seguridad.']),
    crearElemento('p', {}, ['Al borrar todo se eliminan operaciones, importaciones, velas y brokers. Al borrar una cuenta se conservan las demás y los ficheros de velas cargados. Los ajustes de pantalla (como «Mostrar horas en») se mantienen.']),
    exportar,
    crearElemento('label', { class: 'campo campo--filtro' }, ['Qué borrar', selector]),
    crearElemento('label', { class: 'campo campo--filtro' }, [`Escribe ${palabra} para confirmar`, campo]),
    boton,
  ]);
}
