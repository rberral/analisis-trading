import type { EstiloTemporal, PerfilEstrategia } from '../services/analisis/perfil-estrategia';
import { ESTRATEGIA } from '../config/app-config';
import { crearElemento } from './dom';
import { importe, porcentaje } from './formato';

const TEXTO_ESTILO: Record<EstiloTemporal, string> = {
  scalping: 'Scalping: operaciones de pocos minutos',
  intradia: 'Intradía: cierras el mismo día',
  swing: 'Swing: una parte importante de tus operaciones dura un día o más',
};

function fila(nombre: string, valor: string): HTMLElement {
  return crearElemento('tr', {}, [crearElemento('th', {}, [nombre]), crearElemento('td', {}, [valor])]);
}

function textoDuracion(minutos: number): string {
  if (minutos < 60) return `${importe(minutos)} min`;
  if (minutos < 2880) return `${importe(minutos / 60)} h`;
  return `${importe(minutos / 1440)} días`;
}

function textoDistribucion(perfil: PerfilEstrategia): string {
  const d = perfil.distribucionDuracion;
  return `menos de ${ESTRATEGIA.scalpingMinutos} min: ${porcentaje(d.menosDeScalping)} · mismo día: ${porcentaje(d.mismoDia)} · un día o más: ${porcentaje(d.undiaOMas)}`;
}

function textoEntradas(perfil: PerfilEstrategia): string {
  const e = perfil.entradas;
  if (!e) return 'Carga velas de tus activos para ver desde dónde entras.';
  const pct = (cuantas: number) => porcentaje((cuantas / e.muestras) * 100);
  return `A favor del último movimiento (máximos o mínimos recientes): ${pct(e.seguimiento)} · contra el movimiento: ${pct(e.contraMovimiento)} · zona media: ${pct(e.enMedio)} (sobre ${e.muestras} operaciones con velas)`;
}

export function crearTarjetaPerfil(perfil: PerfilEstrategia): HTMLElement {
  const sesiones = [...perfil.sesiones]
    .filter((sesion) => sesion.porcentaje > 0)
    .sort((a, b) => b.porcentaje - a.porcentaje)
    .map((sesion) => `${sesion.nombre} ${porcentaje(sesion.porcentaje)}`)
    .join(' · ');
  return crearElemento('div', { class: 'tarjeta' }, [
    crearElemento('h2', {}, ['Perfil de tu operativa']),
    crearElemento('table', { class: 'tabla-datos' }, [
      crearElemento('tbody', {}, [
        fila('Estilo', TEXTO_ESTILO[perfil.estilo]),
        fila('Duración mediana', textoDuracion(perfil.duracionMedianaMinutos)),
        fila('Cuánto tardan en cerrarse', textoDistribucion(perfil)),
        fila('Operaciones por día con actividad', importe(perfil.operacionesPorDiaActivo)),
        fila('Compras / ventas', `${porcentaje(perfil.porcentajeCompras)} / ${porcentaje(100 - perfil.porcentajeCompras)}`),
        fila('Lotes habituales (mediana)', importe(perfil.lotesMedianos)),
        fila('Con stop loss / con take profit', `${porcentaje(perfil.porcentajeConStopLoss)} / ${porcentaje(perfil.porcentajeConTakeProfit)}`),
        fila('Relación objetivo/riesgo planificada', perfil.ratioPlanificado === null ? '—' : `${importe(perfil.ratioPlanificado)} : 1`),
        fila('Sesiones en las que abres (UTC)', sesiones),
        fila('Desde dónde entras', textoEntradas(perfil)),
      ]),
    ]),
    crearElemento('p', { class: 'texto-suave' }, ['Es una descripción de lo que muestran tus datos, no una etiqueta de estrategia. La relación objetivo/riesgo se mide en operaciones cerradas por su stop loss (así el stop no se había movido).']),
  ]);
}
