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
Para que el asistente responda preguntas libres, el servidor necesita acceso a internet hacia la API de Gemini y una clave válida. Sin esa configuración, la aplicación mostrará un aviso y no simulará respuestas de Gemini.

```env
PORT=3000
GEMINI_API_KEY=tu_clave
GEMINI_MODEL=gemini-2.0-flash
```

## Despliegue
La app está lista para desplegarse en Render como servicio web Node.js.
- Usa el comando `npm start`.
- Configura la variable `GEMINI_API_KEY` en el panel de Render.
- La aplicación escucha en `process.env.PORT`.
