import Dexie from 'dexie';
import { BASE_DE_DATOS_CONFIG } from '../../config/database-config';
import { logger } from '../../core/logger';

/**
 * Único fichero que conoce Dexie (la librería de IndexedDB). Si se cambia de
 * librería, solo hay que tocar este fichero y los repositorios que se añadan aquí.
 */
export function abrirBaseDeDatos(): Dexie {
  const baseDeDatos = new Dexie(BASE_DE_DATOS_CONFIG.nombre);
  for (const { version, tablas } of BASE_DE_DATOS_CONFIG.versiones) {
    baseDeDatos.version(version).stores({ ...tablas });
  }
  return baseDeDatos;
}

/**
 * Pide al navegador que no borre los datos por falta de espacio.
 * El navegador puede rechazarlo; en ese caso la copia de seguridad es la protección.
 */
export async function solicitarAlmacenamientoPersistente(): Promise<boolean> {
  if (!navigator.storage?.persist) return false;
  const concedido = await navigator.storage.persist();
  logger.info(concedido ? 'Almacenamiento persistente concedido' : 'Almacenamiento persistente no concedido');
  return concedido;
}
