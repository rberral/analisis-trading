/**
 * Único sitio donde se crean los objetos concretos y se conectan entre sí.
 * El resto del código recibe lo que necesita ya construido.
 */
import type Dexie from 'dexie';
import { crearParsers } from './adapters/statement-parsers/registro-parsers';
import { abrirBaseDeDatos } from './adapters/storage/base-de-datos';
import { RepositorioOperacionesDexie } from './adapters/storage/operaciones-repositorio';
import { ServicioImportacion } from './services/importacion/importacion-service';

export interface Aplicacion {
  readonly baseDeDatos: Dexie;
  readonly servicioImportacion: ServicioImportacion;
}

export function crearAplicacion(): Aplicacion {
  const baseDeDatos = abrirBaseDeDatos();
  const repositorio = new RepositorioOperacionesDexie(baseDeDatos);
  return {
    baseDeDatos,
    servicioImportacion: new ServicioImportacion(crearParsers(), repositorio),
  };
}
