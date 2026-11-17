import { StepGuideContent } from '../types/model';

export const STEP_GUIDES: StepGuideContent[] = [
  {
    stepNumber: 1,
    phase: '1. Comprensión del negocio',
    title: 'Pregunta de negocio y costos del error',
    whatItMeansTitle: '¿Por qué empezamos por el negocio y no por las fórmulas?',
    whatItMeansBody:
      'En la metodología CRISP-DM todo proyecto analítico nace de una decisión concreta. Antes de correr números, debemos tener claro qué evento Sí/No queremos anticipar, qué acción tomará el equipo con esa alerta y cuál equivocación sale más cara para la empresa.',
    whatItMeansExample:
      'Si un proveedor despacha insumos médicos a crédito, no detectar a una IPS que sí se va a retrasar (falso negativo) puede obligar al proveedor a pedir un préstamo costoso; en cambio, llamar preventivamente a una IPS que sí iba a pagar (falsa alarma) cuesta muy poco.',
  },
  {
    stepNumber: 2,
    phase: '2. Comprensión de los datos',
    title: 'Cargar datos, estructura y calidad',
    whatItMeansTitle: '¿Qué revisamos en la vista previa y calidad de datos?',
    whatItMeansBody:
      'Antes de modelar verificamos cómo leyó el computador cada columna (si es número o texto, equivalente a str() en R) y buscamos dos problemas típicos: datos vacíos (faltantes) y valores imposibles en la vida real.',
    whatItMeansExample:
      'Si una IPS aparece con -2 meses de antigüedad o sin dato de años en su dirección actual, reportamos la fila exacta para corregir o excluir ese registro antes de entrenar el modelo.',
  },
  {
    stepNumber: 3,
    phase: '2. Comprensión de los datos',
    title: 'Definir la variable objetivo (Sí / No)',
    whatItMeansTitle: '¿Por qué convertimos la meta en 1 y 0 y evitamos la regresión lineal?',
    whatItMeansBody:
      'La regresión logística predice la probabilidad (entre 0% y 100%) de que ocurra la clase de interés, etiquetada como 1. Una regresión lineal tradicional traza una línea recta sin límites, por lo que arroja probabilidades imposibles menores a 0% o mayores a 100% y un R² engañoso.',
    whatItMeansExample:
      'Definimos retrasos = 1 como "la IPS se retrasa en el pago" (lo que queremos detectar) y 0 como "paga a tiempo".',
  },
  {
    stepNumber: 4,
    phase: '2. Comprensión de los datos',
    title: 'Análisis descriptivo y comparación entre grupos',
    whatItMeansTitle: '¿Qué buscamos al comparar el grupo 0 frente al grupo 1?',
    whatItMeansBody:
      'Resumimos las variables numéricas con promedios y dispersión, y las categóricas con conteos (nunca promedios de códigos). Luego comparamos el promedio de cada variable entre quienes NO presentan el evento (0) y quienes SÍ lo presentan (1) para descubrir pistas tempranas.',
    whatItMeansExample:
      'Si las IPS que se retrasan (grupo 1) tienen en promedio 65% de pasivos frente a 38% en las cumplidas (grupo 0), esa variable promete ser un gran predictor.',
  },
  {
    stepNumber: 5,
    phase: '3. Preparación de los datos',
    title: 'Balance de clases',
    whatItMeansTitle: '¿Por qué importa si hay muchos ceros y pocos unos?',
    whatItMeansBody:
      'Cuando el evento de interés es minoritario (por ejemplo menor al 20%), el modelo puede volverse "perezoso" y predecir casi todo como 0. El balanceo ajusta las proporciones SOLO en los datos de entrenamiento para que el modelo aprenda a reconocer la clase minoritaria, dejando los datos de prueba intactos.',
    whatItMeansExample:
      'En la cartera de 852 IPS hay 659 cumplidas (77%) y 193 con retraso (23%). Si una base tuviera solo 8% de unos, aplicaríamos sobremuestreo, submuestreo, SMOTE o pesos por clase únicamente en entrenamiento.',
  },
  {
    stepNumber: 6,
    phase: '3. Preparación de los datos',
    title: 'Variables categóricas, dummies y selección',
    whatItMeansTitle: '¿Por qué un código de 1 a 5 no se mete como número normal?',
    whatItMeansBody:
      'Un código como TIPO_ips (1, 2, 3, 4, 5) identifica categorías distintas, no cantidades: el tipo 4 no vale el doble que el tipo 2. Al convertirlo en factor y luego en n − 1 columnas binarias (dummies) frente a una categoría de referencia, medimos el efecto real de cada tipo sin duplicar información.',
    whatItMeansExample:
      'Si TIPO_ips tiene 5 categorías y elegimos el Tipo 1 como referencia, creamos 4 columnas (Tipo 2, 3, 4 y 5) y retiramos la columna original para no duplicarla.',
  },
  {
    stepNumber: 7,
    phase: '3. Preparación de los datos',
    title: 'División en entrenamiento y prueba',
    whatItMeansTitle: '¿Para qué guardamos datos sin que el modelo los vea?',
    whatItMeansBody:
      'Dividimos la base en una parte de Entrenamiento (para que el modelo aprenda los pesos) y una de Prueba (para evaluarlo con casos nuevos). Fijar una semilla aleatoria garantiza que si repites el ejercicio mañana obtendrás exactamente la misma partición.',
    whatItMeansExample:
      'Con división 75/25 estratificada sobre 852 IPS, ~639 van a entrenamiento y ~213 a prueba, manteniendo ~23% de retrasos en ambos grupos.',
  },
  {
    stepNumber: 8,
    phase: '4. Modelado',
    title: 'Modelo logístico, p-values y Odds Ratios',
    whatItMeansTitle: '¿Cómo se leen los coeficientes, el p-value y el Odds Ratio?',
    whatItMeansBody:
      'El modelo trabaja en dos pasos: primero calcula un puntaje lineal z = b0 + b1·X1 + ... (igual que una regresión múltiple) y luego lo transforma en probabilidad entre 0 y 1 con la función sigmoide. Si p < 0,05, la variable tiene evidencia sólida; el Odds Ratio (e^b) traduce el efecto a porcentaje de cambio en las chances.',
    whatItMeansExample:
      'Si b = -0,12 en años en la dirección actual, e^(-0,12) = 0,887: cada año adicional reduce las chances de retraso en un 11,3%. El AIC sirve para comparar modelos (menor AIC = mejor ajuste penalizado).',
  },
  {
    stepNumber: 9,
    phase: '4. Modelado',
    title: 'Curva S y punto de corte',
    whatItMeansTitle: '¿Qué es la curva S y quién decide el punto de corte?',
    whatItMeansBody:
      'La curva logística tiene forma de "S" suave entre 0 y 1. El modelo entrega probabilidades continuas, pero el negocio necesita tomar decisiones de Sí o No usando un umbral o punto de corte (0,50 por defecto). Ese corte no es una ley fija: lo elige el equipo analizando dónde cambia la pendiente y cuánto cuesta equivocarse.',
    whatItMeansExample:
      'Si bajar el corte a 0,35 permite detectar muchas más IPS morosas sin disparar demasiadas falsas alarmas, conviene ajustarlo allí.',
  },
  {
    stepNumber: 10,
    phase: '5. Evaluación',
    title: 'Matriz de confusión (Entrenamiento vs. Prueba)',
    whatItMeansTitle: '¿Cómo leer la matriz y por qué la accuracy puede engañar?',
    whatItMeansBody:
      'La matriz enfrenta la realidad (en filas) contra la predicción del modelo (en columnas; recuerda que en R table() las muestra al revés). La diagonal verde son los aciertos. Si el 90% de los clientes no se retrasa, un modelo que diga siempre "No" tendrá 90% de accuracy pero 0% de F1 en la clase de interés.',
    whatItMeansExample:
      'En marketing un 70% de desempeño puede ser útil para campañas masivas; en salud o fraude crítico se exige 90%–99%. Además comparamos entrenamiento vs. prueba para detectar sobreajuste.',
  },
  {
    stepNumber: 11,
    phase: '5. Evaluación',
    title: 'Curva ROC, AUC y gráfico Lift',
    whatItMeansTitle: '¿Qué miden el AUC y el gráfico de Lift?',
    whatItMeansBody:
      'La curva ROC evalúa la capacidad del modelo para separar unos y ceros a lo largo de todos los cortes posibles (AUC = 0,50 es azar; > 0,80 es muy bueno). El Lift responde una pregunta comercial directa: si ordeno a mis clientes de mayor a menor probabilidad y contacto solo al 20% más riesgoso, ¿qué porcentaje de los casos reales atrapo frente a escoger al azar?',
    whatItMeansExample:
      'Un Lift de 2,5x al contactar el 20% superior significa que encuentras el 50% de los retrasos llamando solo a la quinta parte de la cartera.',
  },
  {
    stepNumber: 12,
    phase: '5. Evaluación',
    title: 'Ganancia neta y punto de corte óptimo',
    whatItMeansTitle: '¿Cómo convertimos probabilidades en dinero para el negocio?',
    whatItMeansBody:
      'Cada acierto o error tiene un impacto financiero. Al ingresar el beneficio de anticipar un verdadero positivo, el costo de una falsa alarma y el costo de no detectar un caso real, calculamos la ganancia neta esperada para cada punto de corte posible.',
    whatItMeansExample:
      'Si un falso negativo cuesta $ 6.200.000 y una llamada preventiva solo $ 180.000, el punto de corte que maximiza el dinero ahorrado suele ser menor a 0,50.',
  },
  {
    stepNumber: 13,
    phase: '5. Evaluación',
    title: 'Comparar versiones del modelo',
    whatItMeansTitle: '¿Cómo elegimos el modelo ganador?',
    whatItMeansBody:
      'Un buen científico de datos prueba distintas combinaciones de variables, balanceo y punto de corte, guardando cada versión. El objetivo principal no es inflar la accuracy total, sino subir el F1 de la clase de interés y el AUC en datos de prueba manteniendo un AIC competitivo.',
    whatItMeansExample:
      'Compara un modelo base con todas las variables frente a uno depurado solo con variables significativas o con balanceo SMOTE para comprobar cuál rinde mejor en prueba.',
  },
  {
    stepNumber: 14,
    phase: '6. Despliegue',
    title: 'Predicción individual paso a paso',
    whatItMeansTitle: '¿Cómo calcula el modelo el riesgo de un cliente nuevo?',
    whatItMeansBody:
      'Al ingresar los datos de un cliente específico, vemos en cámara lenta cómo cada variable se multiplica por su coeficiente para sumar el puntaje z, luego cómo la fórmula 1 / (1 + e^(-z)) lo convierte en probabilidad, y finalmente si supera el punto de corte.',
    whatItMeansExample:
      'En la base de satisfacción bancaria, ingresa edad = 41 y saldo = 1.000 para observar el cálculo exacto de z, la probabilidad resultante y la clasificación final.',
  },
  {
    stepNumber: 15,
    phase: '6. Despliegue',
    title: 'Segmentación y acciones de negocio',
    whatItMeansTitle: '¿Cómo traducimos la probabilidad en planes de acción?',
    whatItMeansBody:
      'En lugar de tratar a todos los casos por igual con un simple Sí/No, dividimos la cartera en tres franjas —Riesgo Bajo, Medio y Alto— para asignar recursos proporcionales al peligro de cada cliente.',
    whatItMeansExample:
      'Riesgo bajo: factura habitual; Riesgo medio: recordatorio automático y descuento por pronto pago; Riesgo alto: cobro preventivo telefónico y revisión de cupo de crédito.',
  },
  {
    stepNumber: 16,
    phase: '6. Despliegue',
    title: 'Exportar informe ejecutivo y predicciones',
    whatItMeansTitle: '¿Qué entregables se lleva el equipo de negocio?',
    whatItMeansBody:
      'Descarga un informe HTML completo con toda la historia CRISP-DM, tablas de coeficientes, métricas de evaluación y el código R equivalente listo para auditoría, además de la tabla CSV con cada registro puntuado.',
    whatItMeansExample:
      'El área de cartera abre el CSV en Excel para filtrar los casos de Riesgo Alto y comenzar las llamadas preventivas hoy mismo.',
  },
];
