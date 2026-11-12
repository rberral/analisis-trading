import { crearElemento } from './dom';

export interface OpcionesConversor {
  /** Moneda de la cuenta; vacía si los datos son anteriores a registrarla. */
  readonly moneda: string;
  readonly destino: string;
  /** Cantidad con la que aparece el conversor (el resultado neto del filtro). */
  readonly importeInicial: number;
  readonly tasaInicial: number | null;
  readonly origenInicial: string;
  readonly leerTasa: (texto: string) => number | null;
  readonly convertir: (importe: number, tasa: number) => number;
  /** Guarda el cambio escrito a mano; devuelve el texto de origen o lanza un error con el mensaje para el usuario. */
  readonly alFijarManual: (texto: string) => { readonly tasa: number; readonly origen: string };
  readonly alActualizar: () => Promise<{ readonly tasa: number; readonly origen: string }>;
}

const numero = (decimales: number) => new Intl.NumberFormat('es-ES', { minimumFractionDigits: decimales, maximumFractionDigits: decimales });

/** Tarjeta que dice en qué moneda están los importes y ofrece su equivalente en euros. */
export function crearConversor(opciones: OpcionesConversor): HTMLElement {
  const { moneda, destino } = opciones;
  if (moneda === '') {
    return crearElemento('p', { class: 'aviso' }, ['La moneda de esta cuenta no está registrada (datos anteriores). Borra los datos y vuelve a importar el informe para que se guarde.']);
  }
  if (moneda === destino) {
    return crearElemento('p', { class: 'aviso' }, [`Los importes de esta cuenta están en ${moneda}.`]);
  }

  let tasa = opciones.tasaInicial;
  const campoImporte = crearElemento('input', { type: 'text', name: 'Importe a convertir', inputmode: 'decimal', value: numero(2).format(opciones.importeInicial) }) as HTMLInputElement;
  const campoTasa = crearElemento('input', { type: 'text', name: 'Cambio', inputmode: 'decimal', value: tasa === null ? '' : String(tasa) }) as HTMLInputElement;
  const resultado = crearElemento('strong', { class: 'conversor__resultado' });
  const estado = crearElemento('p', { class: 'texto-suave', role: 'status' });
  const botonGuardar = crearElemento('button', { type: 'button', class: 'boton' }, ['Guardar cambio']) as HTMLButtonElement;
  const botonActualizar = crearElemento('button', { type: 'button', class: 'boton' }, ['Actualizar (BCE)']) as HTMLButtonElement;

  const mostrarEstado = (origen: string) => estado.replaceChildren(tasa === null ? 'Escribe el cambio o pulsa «Actualizar (BCE)» para consultarlo.' : `Cambio: ${origen}.`);
  const pintar = () => {
    const importe = opciones.leerTasa(campoImporte.value.replace(/\./g, ''));
    const esNegativo = campoImporte.value.trim().startsWith('-');
    const valor = importe === null ? null : (esNegativo ? -importe : importe);
    resultado.replaceChildren(tasa === null || valor === null ? '—' : `${numero(2).format(opciones.convertir(valor, tasa))} ${destino}`);
  };

  campoImporte.addEventListener('input', pintar);
  botonGuardar.addEventListener('click', () => {
    try {
      const guardado = opciones.alFijarManual(campoTasa.value);
      tasa = guardado.tasa;
      mostrarEstado(guardado.origen);
    } catch (error) {
      estado.replaceChildren(error instanceof Error ? error.message : 'No se pudo guardar el cambio.');
    }
    pintar();
  });
  botonActualizar.addEventListener('click', () => {
    botonActualizar.disabled = true;
    estado.replaceChildren('Consultando el cambio…');
    opciones
      .alActualizar()
      .then((nuevo) => {
        tasa = nuevo.tasa;
        campoTasa.value = String(nuevo.tasa);
        mostrarEstado(nuevo.origen);
      })
      .catch((error: unknown) => estado.replaceChildren(error instanceof Error ? error.message : 'No se pudo obtener el cambio.'))
      .finally(() => {
        botonActualizar.disabled = false;
        pintar();
      });
  });

  mostrarEstado(opciones.origenInicial);
  pintar();
  return crearElemento('section', { class: 'tarjeta' }, [
    crearElemento('h2', {}, [`Moneda de la cuenta: ${moneda}`]),
    crearElemento('p', { class: 'texto-suave' }, [`Todos los importes están en ${moneda}. Aquí puedes ver su equivalente en ${destino}; es solo orientativo y no cambia tus datos.`]),
    crearElemento('div', { class: 'barra-filtros' }, [
      crearElemento('label', { class: 'campo campo--filtro' }, [`Importe en ${moneda} (por defecto, el resultado neto del filtro)`, campoImporte]),
      crearElemento('label', { class: 'campo campo--filtro' }, [`Cambio: 1 ${moneda} = … ${destino}`, campoTasa]),
    ]),
    crearElemento('p', {}, [`Equivale a `, resultado]),
    crearElemento('div', { class: 'fila-exportar' }, [botonGuardar, botonActualizar]),
    estado,
    crearElemento('p', { class: 'texto-suave' }, ['«Actualizar (BCE)» envía una petición a una API pública gratuita (Frankfurter, con datos del Banco Central Europeo) solo cuando pulsas el botón; la aplicación no envía tus operaciones ni ningún otro dato. Si no hay conexión, escribe el cambio a mano.']),
  ]);
}
