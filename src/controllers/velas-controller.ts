import { HORARIOS_PREDEFINIDOS, TEMPORALIDADES } from '../config/app-config';
import type { Aplicacion } from '../composicion';
import { ErrorDeUsuario } from '../core/errores';
import { logger } from '../core/logger';
import type { AnalisisCargaVelas } from '../services/velas/servicio-velas';
import { crearElemento } from '../views/dom';
import { crearVistaVelas, type DatosFormularioVelas } from '../views/velas-view';
import { construirHorario } from './horario-controller';
import { crearVisualizadorActual } from './horas-controller';

/** Pantalla de velas: recoge el formulario, pide el análisis y, si el usuario confirma, guarda. */
export function crearPaginaVelas(aplicacion: Aplicacion): HTMLElement {
  const servicio = aplicacion.servicioVelas;
  let pendiente: AnalisisCargaVelas | null = null;
  const contenedor = crearElemento('div');

  const alAnalizar = (datos: DatosFormularioVelas) => void analizar(datos);
  const alGuardar = () => void guardar();

  async function analizar(datos: DatosFormularioVelas): Promise<void> {
    pendiente = null;
    const vista = vistaActual();
    try {
      if (!datos.fichero) throw new ErrorDeUsuario('Elige el fichero de velas.');
      const horario = construirHorario(datos);
      vista.mostrarCargando('Leyendo y comprobando el fichero…');
      pendiente = await servicio.analizar(await datos.fichero.text(), {
        activo: datos.activo,
        temporalidad: datos.temporalidad,
        broker: datos.broker.trim() === '' ? null : datos.broker.trim(),
        horario,
        nombreFichero: datos.fichero.name,
      });
      const horas = (await crearVisualizadorActual(aplicacion)).conOrigen(pendiente.registro.id, horario);
      vista.mostrarAnalisis(pendiente, horas);
    } catch (error) {
      informarError(vista, error, 'Fallo inesperado al analizar las velas');
    }
  }

  async function guardar(): Promise<void> {
    const vista = vistaActual();
    if (!pendiente) return;
    try {
      await servicio.guardar(pendiente);
      vista.mostrarGuardado(pendiente.registro);
      pendiente = null;
      vista.mostrarCargas(await servicio.listarCargas(), await crearVisualizadorActual(aplicacion));
    } catch (error) {
      informarError(vista, error, 'Fallo inesperado al guardar las velas');
    }
  }

  let vista: ReturnType<typeof crearVistaVelas> | null = null;
  const vistaActual = () => {
    if (!vista) throw new Error('La pantalla de velas aún no está lista');
    return vista;
  };

  async function iniciar(): Promise<void> {
    const datos = await aplicacion.lectorDatos.leerTodo();
    const activos = [...new Set(datos.operaciones.map((operacion) => operacion.activo))].sort();
    vista = crearVistaVelas({ temporalidades: TEMPORALIDADES, horarios: HORARIOS_PREDEFINIDOS, activos, alAnalizar, alGuardar });
    contenedor.replaceChildren(vista.elemento);
    vista.mostrarCargas(await servicio.listarCargas(), await crearVisualizadorActual(aplicacion));
  }

  iniciar().catch((error: unknown) => {
    logger.error('No se pudo preparar la pantalla de velas', error);
    contenedor.replaceChildren(crearElemento('p', { class: 'aviso aviso--atencion', role: 'alert' }, ['No se pudieron leer los datos guardados en este navegador.']));
  });
  return contenedor;
}

function informarError(vista: { mostrarError(mensaje: string): void }, error: unknown, mensajeLog: string): void {
  if (error instanceof ErrorDeUsuario) {
    vista.mostrarError(error.message);
    return;
  }
  logger.error(mensajeLog, error);
  vista.mostrarError('Ha ocurrido un error inesperado.');
}
