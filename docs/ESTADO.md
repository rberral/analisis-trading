# Estado del proyecto (para retomarlo)

Última actualización: 2026-11-12

## Qué es
Diario de trading: web estática (TypeScript + Vite, sin framework; Dexie, Lightweight Charts, Vitest) publicada en GitHub Pages. Sin roles ni permisos. Los datos viven en el navegador (IndexedDB) de cada usuario. Los ficheros subidos no se guardan.

## Decisiones tomadas
- Todas las horas se guardan en UTC. El horario del servidor del broker lo elige el usuario al subir cada fichero (zona con nombre o regla «Nueva York + N horas»); no se deduce nada ni hay valor por defecto.
- ID de operación = `cuenta:ticket`. Reimportar no duplica; una abierta que ya está cerrada se actualiza.
- Cada importación guarda una foto del SL/TP de las operaciones abiertas (sirve para detectar movimientos de SL; el informe solo da el SL final).
- Velas: el fichero NO se guarda; solo las ventanas de velas por operación y los resultados derivados. El formulario pide activo, temporalidad, horario UTC del broker y broker (opcional).
- Periodos en UTC por hora de cierre; el drawdown se calcula dentro del periodo.
- Informe a usar: el *Detailed Statement* de MT4 (trae totales para validar).

## Hecho
1. Esqueleto, despliegue en GitHub Pages, menú y rutas.
2. Importar informe MT4 con validación de totales (las 25 cifras coinciden con el informe real).
3. Panel, Operaciones y Errores y consejos, con filtros por periodo, activo y cuenta. Errores solo con el informe: sin stop loss, aperturas erróneas (sin SL cerradas en < 5 min), pérdidas desproporcionadas, subir lotes tras perder, sobreoperación, perdedoras más largas que ganadoras. Umbrales en `src/config/app-config.ts`.

4. Velas: carga del CSV de MT4 (activo, temporalidad, horario, broker opcional), comprobación del horario con desfases -3..+3 h (no corrige sola), y guardado solo de las ventanas de velas por operación cerrada (IndexedDB v3). Pantalla «Velas y ficheros» con la lista de cargas.
5. Detalle de operación (gráfico con Lightweight Charts, ruta `#/operaciones/<id>`), MFE/MAE, qué pasó tras cerrar a mano, salidas anticipadas en Errores y perfil de la operativa en el Panel. Pendiente de verificar en navegador: el gráfico (la librería no se pudo probar en el contenedor) y que funcione con la CSP de producción (`npm run build` + `npm run preview`).

## Pendiente (hoja de ruta)
6. Exportar a TradingView (Pine Script, límite ≈500 objetos de dibujo, mapeo de símbolos, manual).
7. Copia de seguridad (exportar/importar JSON).

Otros pendientes menores: lista de importaciones anteriores en Importar; resolver horas ambiguas/inexistentes por cambio de horario (hoy solo avisos); actualizar maquetas (quitar el correo de la cabecera, añadir Copia de seguridad).

## Datos de velas (hallazgos)
- El H1 trae un reloj distinto al del informe (+2 h en invierno, +1 h en verano); M5 y M30 coinciden con el del informe.
- El History Center de MT4 limita a 65 000 barras.

## Cómo probar en local
`npm install`, `npm test`, `npm run dev`. No subas informes reales al repositorio (es público): los tests usan `tests/fixtures/informe-mt4.ts`.
