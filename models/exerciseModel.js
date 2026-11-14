const exercises = [
  {
    id: 1,
    title: 'Detección de vulnerabilidades en una auditoría de ciberseguridad',
    distribution: 'binomial',
    params: { n: 18, p: 0.12, threshold: 4 },
    enunciado: 'Una empresa especializada en ciberseguridad realiza auditorías sobre aplicaciones web utilizadas por instituciones financieras. Durante una evaluación, los analistas seleccionan aleatoriamente 18 componentes de software. Según los registros históricos, cada componente tiene una probabilidad del 12 % de presentar una vulnerabilidad crítica. Para este análisis se supone que las condiciones de los componentes son independientes y que la probabilidad de encontrar una vulnerabilidad es constante. La política de seguridad establece que, si se detectan 4 o más componentes vulnerables, deberá suspenderse temporalmente la liberación del sistema.',
    operations: [
      { key: 'exacta_3', label: 'P(X=3)', description: 'Probabilidad exacta de 3 vulnerabilidades.', formula: 'C(18,3) * 0.12^3 * (0.88)^15' },
      { key: 'max_2', label: 'P(X <= 2)', description: 'Probabilidad de como máximo 2 vulnerabilidades.', formula: 'sum_{x=0}^{2} C(18,x) * 0.12^x * 0.88^(18-x)' },
      { key: 'suspension', label: 'P(X >= 4)', description: 'Probabilidad de activar la suspensión.', formula: '1 - P(X <= 3)' },
      { key: 'at_least_1', label: 'P(X >= 1)', description: 'Probabilidad de al menos 1 vulnerabilidad.', formula: '1 - P(X = 0)' }
    ]
  },
  {
    id: 2,
    title: 'Recuperación de paquetes en una red de comunicaciones',
    distribution: 'negativeBinomial',
    params: { r: 5, p: 0.75, maxAttempts: 8 },
    enunciado: 'Una empresa de telecomunicaciones está evaluando un protocolo de recuperación de paquetes de datos. Cuando se detecta un paquete corrupto, el sistema solicita su retransmisión. Cada intento tiene una probabilidad del 75 % de completarse correctamente, de manera independiente. Para restablecer una comunicación, el protocolo necesita obtener 5 retransmisiones exitosas. El sistema cuenta con una política que permite realizar un máximo de 8 intentos antes de activar un mecanismo alternativo de recuperación.',
    operations: [
      { key: 'exacta_7', label: 'P(X=7)', description: 'Probabilidad de que la quinta retransmisión exitosa ocurra exactamente en el séptimo intento.', formula: 'C(6,4) * 0.75^5 * 0.25^2' },
      { key: 'max_8', label: 'P(X <= 8)', description: 'Probabilidad de completar 5 retransmisiones exitosas en un máximo de 8 intentos.', formula: 'sum_{k=5}^{8} C(k-1,4) * 0.75^5 * 0.25^(k-5)' },
      { key: 'at_least_9', label: 'P(X >= 9)', description: 'Probabilidad de necesitar al menos 9 intentos para completar las 5 retransmisiones.', formula: '1 - P(X <= 8)' },
      { key: 'exacta_5', label: 'P(X=5)', description: 'Probabilidad de completar las 5 retransmisiones exactamente en el quinto intento.', formula: 'C(4,4) * 0.75^5 * 0.25^0' }
    ]
  },
  {
    id: 3,
    title: 'Monitoreo de incidentes en un centro de operaciones de seguridad',
    distribution: 'poisson',
    params: { ratePer15: 9, intervalMinutes: 20, alternativeMinutes: 5, threshold: 15 },
    enunciado: 'Un Centro de Operaciones de Seguridad (SOC) monitorea la infraestructura tecnológica de una organización. Los registros indican que se producen, en promedio, 9 alertas de seguridad cada 15 minutos. Se supone que las alertas ocurren independientemente y con una tasa promedio constante durante el período estudiado. El sistema de monitoreo considera que existe una posible situación de riesgo elevado cuando se registran más de 15 alertas durante 20 minutos.',
    operations: [
      { key: 'mean_20', label: 'E[X] para 20 min', description: 'Número promedio de alertas durante 20 minutos.', formula: 'λ = 9 * (20 / 15)' },
      { key: 'exacta_12', label: 'P(X=12)', description: 'Probabilidad de registrar exactamente 12 alertas durante 20 minutos.', formula: '(e^-12 * 12^12) / 12!' },
      { key: 'risk_20', label: 'P(X > 15)', description: 'Probabilidad de riesgo elevado en 20 minutos.', formula: '1 - P(X <= 15)' },
      { key: 'max_3_5min', label: 'P(X <= 3)', description: 'Probabilidad de recibir como máximo 3 alertas en 5 minutos.', formula: 'sum_{x=0}^{3} e^{-3}*3^x/x!' }
    ]
  },
  {
    id: 4,
    title: 'Disponibilidad de servidores en una infraestructura de nube',
    distribution: 'binomial',
    params: { n: 20, p: 0.08, threshold: 3 },
    enunciado: 'Una empresa de servicios tecnológicos administra una plataforma de comercio electrónico mediante una infraestructura de 20 servidores virtuales. Durante las pruebas de disponibilidad, el departamento de operaciones ha determinado que cada servidor tiene una probabilidad del 8 % de presentar una falla durante una ventana de mantenimiento de dos horas. Para efectos del análisis, se considera que las fallas de los servidores ocurren de manera independiente y que todos tienen la misma probabilidad de fallar. El sistema cuenta con mecanismos de redundancia que permiten mantener la operación normal siempre que no fallen más de 3 servidores durante esa ventana.',
    operations: [
      { key: 'exacta_4', label: 'P(X=4)', description: 'Probabilidad de que exactamente 4 servidores presenten fallas.', formula: 'C(20,4) * 0.08^4 * 0.92^16' },
      { key: 'max_3', label: 'P(X <= 3)', description: 'Probabilidad de que fallen como máximo 3 servidores.', formula: 'sum_{x=0}^{3} C(20,x) * 0.08^x * 0.92^(20-x)' },
      { key: 'at_least_5', label: 'P(X >= 5)', description: 'Probabilidad de que fallen al menos 5 servidores.', formula: '1 - P(X <= 4)' }
    ]
  },
  {
    id: 5,
    title: 'Saturación de solicitudes en una API empresarial',
    distribution: 'poisson',
    params: { ratePer3Min: 18, intervalMinutes: 1, alternativeIntervalSeconds: 30, threshold: 10 },
    enunciado: 'Una empresa desarrolló una API REST que permite consultar información de inventarios en tiempo real. El equipo de desarrollo ha observado que, durante determinados períodos, el sistema recibe en promedio 18 solicitudes cada 3 minutos. Se considera que las solicitudes llegan independientemente y con una tasa promedio constante durante el período analizado. El servidor dispone de un mecanismo de protección que genera una alerta cuando recibe más de 10 solicitudes en un minuto.',
    operations: [
      { key: 'mean_1min', label: 'E[X] en 1 minuto', description: 'Cantidad promedio de solicitudes esperadas durante un minuto.', formula: 'λ = 18 / 3' },
      { key: 'exacta_8', label: 'P(X=8)', description: 'Probabilidad de que exactamente 8 solicitudes lleguen durante un minuto.', formula: '(e^-6 * 6^8) / 8!' },
      { key: 'alerta_1min', label: 'P(X > 10)', description: 'Probabilidad de activar la alerta en un minuto.', formula: '1 - P(X <= 10)' },
      { key: 'zero_30s', label: 'P(X=0) en 30s', description: 'Probabilidad de recibir 0 solicitudes durante 30 segundos.', formula: 'e^{-3}' }
    ]
  },
  {
    id: 6,
    title: 'Validación de módulos durante pruebas de software',
    distribution: 'negativeBinomial',
    params: { r: 6, p: 0.65, maxAttempts: 8 },
    enunciado: 'Una empresa de desarrollo está implementando un sistema de gestión académica. Antes de liberar la nueva versión, el equipo de QA ejecuta pruebas de validación sobre módulos seleccionados de un conjunto amplio de componentes. De acuerdo con los registros históricos, cada prueba tiene una probabilidad del 65 % de resultar satisfactoria. Para este estudio se supone que las pruebas son independientes y mantienen la misma probabilidad de éxito. El responsable del proyecto necesita obtener 6 pruebas satisfactorias para completar una fase de validación.',
    operations: [
      { key: 'exacta_10', label: 'P(X=10)', description: 'Probabilidad de que la sexta prueba satisfactoria ocurra exactamente en el décimo intento.', formula: 'C(9,5) * 0.65^6 * 0.35^4' },
      { key: 'max_8', label: 'P(X <= 8)', description: 'Probabilidad de completar 6 pruebas satisfactorias en un máximo de 8 intentos.', formula: 'sum_{k=6}^{8} C(k-1,5) * 0.65^6 * 0.35^(k-6)' },
      { key: 'more_than_10', label: 'P(X > 10)', description: 'Probabilidad de necesitar más de 10 intentos para alcanzar 6 éxitos.', formula: '1 - P(X <= 10)' }
    ]
  },
  {
    id: 7,
    title: 'Tiempo de espera en un sistema de mensajería',
    distribution: 'exponential',
    params: { ratePerMinute: 12, lambdaPerSecond: 0.2 },
    enunciado: 'Una empresa de logística utiliza una arquitectura de microservicios para procesar mensajes relacionados con pedidos, entregas y actualizaciones de inventario. Durante las horas de operación, un servicio recibe en promedio 12 mensajes por minuto. Para el análisis, se supone que los mensajes llegan siguiendo un proceso con tasa constante e independiente. El equipo de monitoreo está interesado en el tiempo transcurrido desde un instante de observación hasta la llegada del siguiente mensaje, debido a que ciertos procesos dependen de la recepción de nuevos eventos.',
    operations: [
      { key: 'before_4s', label: 'P(T < 4s)', description: 'Probabilidad de que el siguiente mensaje llegue antes de 4 segundos.', formula: '1 - e^{-0.2 * 4}' },
      { key: 'after_10s', label: 'P(T > 10s)', description: 'Probabilidad de que transcurran más de 10 segundos sin mensajes.', formula: 'e^{-0.2 * 10}' },
      { key: 'between_3_8s', label: 'P(3s < T < 8s)', description: 'Probabilidad de que el siguiente mensaje llegue entre 3 y 8 segundos.', formula: 'F(8) - F(3)' },
      { key: 'p90', label: 'Percentil 90', description: 'Tiempo de espera para el cual hay un 90 % de probabilidad de que el mensaje haya llegado.', formula: 't = -ln(0.10) / λ' }
    ]
  },
  {
    id: 8,
    title: 'Evaluación del rendimiento de una base de datos',
    distribution: 'normal',
    params: { mean: 240, sd: 35, threshold: 300, percentile: 95 },
    enunciado: 'Una institución financiera implementó una nueva base de datos para procesar consultas relacionadas con movimientos y transacciones. Después de ejecutar pruebas de rendimiento, el equipo de ingeniería determinó que los tiempos de respuesta individuales pueden aproximarse mediante una distribución normal, con los siguientes parámetros: Tiempo promedio 240 ms, Desviación estándar 35 ms. El contrato de nivel de servicio (SLA) establece que al menos el 95 % de las consultas debe responder en 300 milisegundos o menos.',
    operations: [
      { key: 'gt_300', label: 'P(X > 300)', description: 'Probabilidad de que una consulta tarde más de 300 milisegundos.', formula: '1 - Φ((300 - 240) / 35)' },
      { key: 'between_210_280', label: 'P(210 < X < 280)', description: 'Probabilidad de que una consulta tenga un tiempo de respuesta entre 210 y 280 ms.', formula: 'Φ((280-240)/35) - Φ((210-240)/35)' },
      { key: 'lt_200', label: 'P(X < 200)', description: 'Porcentaje de consultas que responden en menos de 200 ms.', formula: 'Φ((200-240)/35)' },
      { key: 'percentile_95', label: 'Percentil 95', description: 'Tiempo máximo de respuesta correspondiente al percentil 95.', formula: 'μ + z0.95 * σ' }
    ]
  }
];

function getAllExercises() {
  return exercises.map((exercise) => ({
    id: exercise.id,
    title: exercise.title,
    distribution: exercise.distribution,
    params: exercise.params,
    enunciado: exercise.enunciado
  }));
}

function getExerciseById(id) {
  const parsedId = Number(id);
  return exercises.find((exercise) => exercise.id === parsedId) || null;
}

module.exports = {
  exercises,
  getAllExercises,
  getExerciseById
};
