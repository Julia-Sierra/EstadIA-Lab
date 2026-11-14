# EstadIA Lab - Manual de uso

EstadIA Lab es una plataforma educativa para analizar, resolver y explicar problemas de estadística usando reconocimiento de patrones y asistente de IA.

## Objetivo
La aplicación permite:
- escribir un problema estadístico en lenguaje natural,
- identificar la distribución más probable,
- calcular la probabilidad asociada,
- interpretar el resultado respecto a la pregunta del problema,
- mostrar el resultado numérico y la fórmula aplicada,
- y preguntar a Gemini directamente sobre el problema.

## Estructura de la interfaz
La aplicación conserva una sola pantalla principal: la vista de ejercicios.

### 1. Campo para introducir el problema
Se encuentra en la parte superior de la página.
- Sirve para escribir el enunciado o descripción del problema.
- Puede ingresarse texto libre, con cifras, expresiones matemáticas o palabras clave como "promedio", "al menos", "exactamente". El formulario admite hasta cinco preguntas por enunciado.
- Luego se pulsa "Analizar problema".

### 2. Resultado del análisis
Después de analizar el texto, la plataforma muestra:
- distribución sugerida,
- nivel de confianza,
- operación estimada,
- fórmula probable,
- resultado numérico,
- y el resultado de cada pregunta, acompañado de su fórmula y porcentaje.

### 3. Enunciado
Muestra el texto del problema que se está resolviendo.
- Si el usuario introduce un problema nuevo, se presenta allí.
- Si se selecciona un ejercicio predefinido, también aparece el enunciado original.

### 4. Parámetros
Se listan los valores detectados del problema, como:
- n, p, x
- media, desviación estándar
- tasa lambda
- entre otros.

### 5. Operaciones
Se muestran los tipos de cálculo posibles para la distribución identificada.
- El usuario puede elegir la operación con el selector.
- Al presionar "Calcular", la aplicación evalúa la operación y presenta el resultado.

### 6. Resultado
Aquí se muestra:
- resultado numérico,
- porcentaje equivalente,
- y fórmula aplicada.

### 7. Videos y ejercicios resueltos
La pestaña **Videos** permite seleccionar y previsualizar videos localmente durante la sesión. La pestaña **Ejercicios resueltos** queda preparada para agregar el documento PDF y habilitar su descarga cuando se adjunte.

### 8. Asistente Gemini
En la sección **Pregunta directamente a Gemini**, escribe la duda y pulsa **Enviar pregunta a Gemini**. La respuesta se muestra en el recuadro debajo del campo, separada del diagnóstico de distribución y de los resultados calculados.

## Cómo usar la aplicación
1. Escribe un problema estadístico en el campo superior.
2. Haz clic en "Analizar problema".
3. Revisa la distribución sugerida y la interpretación.
4. Si es necesario, selecciona una operación específica y pulsa "Calcular".
5. Escribe una pregunta en **Pregunta directamente a Gemini** y pulsa **Enviar pregunta a Gemini** para ver la respuesta en el recuadro.

## Notas importantes
- La plataforma recomienda una distribución, pero debe usarse como guía para el análisis.
- Las gráficas se muestran solo cuando la distribución detectada es Normal.
- Para otras distribuciones, la aplicación prioriza el cálculo y la interpretación, sin gráficos innecesarios.

## Instalación local
```bash
npm install
npm start
```

Luego abre en el navegador:
```text
http://localhost:3000
```

## Configuración de Gemini
Crea un archivo `.env` basado en `.env.example` con tu clave GEMINI_API_KEY.
La clave se utiliza solo en el servidor. El servicio usa la Interactions API con `gemini-3.5-flash-lite` para respuestas rápidas y recurre a `gemini-3.6-flash` si el modelo principal devuelve un error HTTP.

```env
PORT=3000
GEMINI_API_KEY=tu_clave
```

## Despliegue en GitHub Pages y Vercel
GitHub Pages sirve la interfaz estática; Vercel sirve las funciones API de `/api` y el backend Express que usa el resto de la aplicación.

1. Importa este repositorio en Vercel, conservando la raíz del proyecto. Vercel detectará `api/gemini.js` y `api/[...path].js`.
2. En la configuración del proyecto Vercel, define `GEMINI_API_KEY` como variable secreta y `CORS_ALLOWED_ORIGINS` con el origen de Pages: `https://julia-sierra.github.io` (sin ruta ni barra final).
3. Despliega Vercel y copia el dominio de proyecto, por ejemplo `https://estadialab.vercel.app`. En GitHub, agrega la variable de repositorio `API_ENDPOINT` en **Settings → Secrets and variables → Actions → Variables**, con el valor `https://<dominio-vercel>/api`.
4. En **Settings → Pages**, selecciona **GitHub Actions** como fuente. El workflow `.github/workflows/deploy.yml` publica la interfaz en cada push a `main`.

La URL del sitio será `https://julia-sierra.github.io/EstadIA-Lab/`. Si `API_ENDPOINT` aún no está configurado, la interfaz se publica pero las funciones API no estarán disponibles. No subas `.env` a GitHub; configura `GEMINI_API_KEY` únicamente en el entorno de Vercel.

Para desarrollo local, ejecuta `npm install` y `npm start`. La aplicación usará `/api` en el mismo servidor Express.
