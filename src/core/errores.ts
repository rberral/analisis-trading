/**
 * Error cuyo mensaje se puede enseñar tal cual al usuario (fichero no válido,
 * horario mal indicado…). Cualquier otro error se considera un fallo interno y
 * se registra sin mostrar sus detalles.
 */
export class ErrorDeUsuario extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ErrorDeUsuario';
  }
}
