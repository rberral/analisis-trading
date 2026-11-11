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
