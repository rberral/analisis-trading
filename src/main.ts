import './styles/app.css';
import { solicitarAlmacenamientoPersistente } from './adapters/storage/base-de-datos';
import { crearAplicacion } from './composicion';
import { mostrarPagina } from './controllers/paginas-controller';
import { logger } from './core/logger';
import { iniciarRouter } from './core/router';

function arrancar(): void {
  const contenedor = document.getElementById('app');
  if (!contenedor) {
    logger.error('No se encuentra el contenedor principal de la página');
    return;
  }

  const aplicacion = crearAplicacion();
  iniciarRouter((ruta) => mostrarPagina(contenedor, ruta, aplicacion));

  // La base de datos se abre en segundo plano: las pantallas ya funcionan sin ella.
  aplicacion.baseDeDatos
    .open()
    .then(solicitarAlmacenamientoPersistente)
    .catch((error: unknown) => logger.error('No se pudo abrir la base de datos local', error));
}

window.addEventListener('unhandledrejection', (evento) => {
  logger.error('Error no controlado', evento.reason);
});

arrancar();
