# Diario de trading

Aplicación web que importa las operaciones de una plataforma de trading (primero MetaTrader 4),
calcula estadísticas, analiza errores y estrategia y las dibuja sobre un gráfico de velas.

Funciona **entera en el navegador**: no hay servidor ni base de datos externa. Tus datos se guardan
en el navegador de tu equipo (IndexedDB) y no salen de él. Se publica con GitHub Pages.

Estado actual: **esqueleto** (navegación, configuración, base de datos local y publicación).
Las pantallas se construyen por fases: importación del informe, estadísticas y errores, velas,
MAE/MFE y estrategia, y exportación a Pine Script.

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/config/` | `app-config.ts` (única configuración) y `database-config.ts` (esquema de la base de datos, por versiones) |
| `src/models/` | Tipos de datos (operaciones, velas…) |
| `src/controllers/` | Deciden qué pantalla se muestra; solo coordinan |
| `src/views/` | Dibujan las pantallas; sin lógica de negocio |
| `src/services/` | Lógica de negocio (estadísticas, errores, estrategia, importación) |
| `src/adapters/` | Todo lo externo: base de datos, parsers de plataformas, velas, Pine Script |
| `src/core/` | Piezas comunes (navegación, registro de mensajes) |
| `tests/` | Pruebas con Vitest |

Los módulos solo se comunican por su interfaz pública. Cambiar de librería o de plataforma afecta a un único fichero de `adapters/`.

## Instalación y desarrollo

Requisitos: Node.js 20 o superior.

```bash
npm install     # instala las dependencias (la primera vez crea package-lock.json: súbelo a GitHub)
npm run dev     # servidor de desarrollo en http://localhost:5173
npm test        # ejecuta las pruebas
npm run build   # comprueba los tipos y genera la carpeta dist/
```

## Importar operaciones (MetaTrader 4)

En la pantalla **Importar** eliges el informe HTML (se recomienda el *Detailed Statement*, que incluye totales para validar), indicas el horario del servidor del broker (lista de horarios habituales con su UTC, o una zona/regla propia; no hay ninguno preseleccionado) y la aplicación:

- convierte todas las horas a UTC (sin deducir nada: el horario es obligatorio);
- guarda solo las operaciones nuevas y actualiza las que estaban abiertas y ya se han cerrado;
- recalcula las estadísticas y las compara con las del informe (tabla *Coincide / Diferencia*).

El fichero no se guarda: se lee, se importa y se descarta. Los datos quedan en el navegador (IndexedDB).

Las pruebas usan un informe inventado (`tests/fixtures/informe-mt4.ts`); no subas informes reales al repositorio.

## Velas y ficheros (MetaTrader 4)

En **Velas y ficheros** cargas el CSV de velas que exporta MetaTrader 4 (Centro de historial). Hay que indicar el activo, la temporalidad y el horario del servidor del broker (obligatorio; el broker es opcional). Antes de guardar, la aplicación comprueba que el horario es el correcto: mira si el precio de entrada y de salida de tus operaciones está dentro de la vela de ese momento y lo repite con desfases de -3 a +3 horas, para que veas cuál encaja mejor. No corrige nada sola.

El fichero de velas **no se guarda**: solo se conservan, para cada operación cerrada, las velas de su duración más 20 antes y 20 después (como máximo 3 000). Los parámetros están en `VELAS` (`src/config/app-config.ts`).

## Detalle de operación, recorrido y perfil

Pulsando el ticket en **Operaciones** se abre el detalle: datos de la operación y, si has cargado velas, un gráfico con entrada, salida, stop loss y take profit (Lightweight Charts, horas en UTC). Con las velas se calcula:

- **Recorrido del precio (MFE/MAE):** máximo a favor y en contra, y qué parte del camino hasta el TP y el SL llegó a recorrer. Es un mínimo: solo cuentan las velas completas dentro de la operación, más los precios de entrada y salida.
- **Qué pasó después de cerrar a mano** una operación con take profit (si llegó al TP o al SL en las velas guardadas posteriores). Con esto, **Errores y consejos** detecta las salidas anticipadas.
- **Perfil de tu operativa** en el Panel: estilo (scalping, intradía, swing), sesiones, uso de SL y TP, relación objetivo/riesgo y desde dónde entras respecto a las últimas velas. Describe lo que muestran los datos; no pone etiquetas de estrategia. Criterios en `ESTRATEGIA` (`src/config/app-config.ts`).

Para probar la versión de producción (con la política de seguridad activa) en local: `npm run build` y `npm run preview`.

## Horas

Todas las horas se guardan en **UTC**: al importar un informe o cargar velas se convierten con el horario del servidor del broker que eliges. En el menú lateral, **Mostrar horas en** permite verlas en UTC (por defecto), en hora del broker (como en MetaTrader) o en hora de España; solo cambia la visualización y la elección se recuerda en el navegador. Los periodos de los filtros siempre se cuentan en UTC.

## Exportar a TradingView

La pantalla **Exportar a TradingView** usa los mismos filtros (periodo, año, activo, cierre) y genera un script Pine v6 por activo, que dibuja cada operación (zonas de TP y SL, entrada, SL movido, salida y tabla de estadísticas). Pasos: elige filtros, ajusta el nombre del activo en TradingView si difiere (p. ej. SP500 → SPX), descarga el `.pine`, pégalo en el Editor de Pine del gráfico de ese activo y pulsa «Añadir al gráfico».

- **Límite:** Pine admite 500 cajas/líneas/etiquetas por script; con 2 de cada por operación caben 250 (`EXPORTACION_TRADINGVIEW` en la configuración). Si un activo tiene más, se reparte en partes (parte 1 de N…) que se añaden como indicadores distintos.
- **Horas:** el script lleva marcas de tiempo UTC absolutas, así que las operaciones caen siempre en su vela; el eje horario lo decide TradingView (Ajustes del gráfico → Zona horaria). «Horas de las etiquetas» solo cambia los textos de los tooltips (UTC, hora del broker u hora de España).
- **Precios:** son los de tu broker; el gráfico de TradingView puede diferir unos pips.

## Panel, Operaciones y Errores

Las tres pantallas comparten una barra de filtros: periodo (total, año, trimestre, mes o rango de fechas), activo y, si hay varias, cuenta. El filtro **Cierre** clasifica por resultado, no por la etiqueta de MetaTrader (que llama «stop loss» también a los stops movidos a beneficio): Take profit (cierre automático con ganancia), Stop loss (con pérdida), Break even (resultado neto menor al 0,1 % del saldo de la cuenta al abrir; tiene prioridad sobre Manual; `CLASIFICACION_CIERRE` en la configuración) y Manual. Los periodos se cuentan en UTC según la hora de **cierre** de la operación, y el drawdown se calcula dentro del periodo elegido, partiendo del balance que había al empezar.

Errores detectados solo con el informe (umbrales en `src/config/app-config.ts`): operaciones sin stop loss, pérdidas desproporcionadas, subir lotes tras perder, sobreoperación diaria y perdedoras más largas que las ganadoras.

## Variables de entorno

Ninguna. Al ser una web estática no hay secretos: todo el código y la configuración son públicos.
Nunca escribas claves ni contraseñas en el código. Si en el futuro hiciera falta una API con clave,
habría que usar un servidor intermedio.

## Despliegue en GitHub Pages

1. Sube el proyecto a un repositorio de GitHub, incluido `package-lock.json`.
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Cada subida a la rama `main` ejecuta las pruebas, compila y publica la web (`.github/workflows/desplegar.yml`).
4. La web quedará en `https://TU_USUARIO.github.io/NOMBRE_DEL_REPOSITORIO/`.

En el plan gratuito la web publicada es pública aunque el repositorio sea privado. Tus datos no lo son:
cada persona solo ve los que están en su propio navegador.

## Tus datos

- Viven solo en el navegador donde uses la aplicación. Si borras los datos del sitio, se pierden.
- Habrá una pantalla de **copia de seguridad** para exportar e importar todo en un fichero. Úsala con regularidad.
- Los ficheros que subas (informes, velas) se procesan y se descartan; no se guardan.

## Seguridad

- El contenido de los ficheros importados nunca se inserta como HTML en la página (protección contra XSS).
- La versión publicada incluye una política de seguridad de contenido que solo permite código de la propia web.
- Activa **Secret scanning** y **Push protection** en GitHub (*Settings → Code security*), aunque el proyecto no use secretos.
