import { BalanceMethod } from '../types/model';

export interface RCodeContext {
  datasetName: string;
  fileName: string;
  targetCol: string;
  positiveClass: string;
  categoricalCols: string[];
  referenceCategories: Record<string, string>;
  selectedPredictors: string[];
  seed: number;
  trainRatio: number;
  balanceMethod: BalanceMethod;
  threshold: number;
  sampleCase: Record<string, string | number>;
}

export function generateRCodeForStep(step: number, ctx: RCodeContext): string {
  const dfName = ctx.datasetName || 'datos';
  const yCol = ctx.targetCol || 'objetivo';
  const pos = ctx.positiveClass || '1';
  const predList =
    ctx.selectedPredictors.length > 0
      ? ctx.selectedPredictors.join(' + ')
      : '.';
  const threshStr = ctx.threshold.toFixed(2);
  const ratioStr = ctx.trainRatio.toFixed(2);

  switch (step) {
    case 1:
      return `# Paso 1: Definir el objetivo de negocio en el script del proyecto
# Pregunta: Predecir "${yCol}" (clase de interés = "${pos}")
# Librerías recomendadas para todo el taller CRISP-DM:
library(readxl)
library(caret)
library(pROC)
library(DMwR2) # o ROSE para balanceo`;

    case 2:
      return `# Paso 2: Cargar la base, revisar primeras filas, estructura y calidad
# Si viene de Excel:
${dfName} <- read_excel("${ctx.fileName.replace(/\.csv$/i, '.xlsx')}")
# O si viene de CSV:
${dfName} <- read.csv("${ctx.fileName}", stringsAsFactors = FALSE)

head(${dfName}, 10)
str(${dfName})

# Revisar valores faltantes (NA) por columna y fila exacta:
colSums(is.na(${dfName}))
which(!complete.cases(${dfName}))

# Detectar valores imposibles (ejemplo: meses o antigüedad negativos):
which(${dfName}$MESES < 0)`;

    case 3:
      return `# Paso 3: Definir variable objetivo Y como factor binario (0 / 1)
${dfName}$${yCol} <- ifelse(${dfName}$${yCol} == "${pos}", 1, 0)
${dfName}$${yCol} <- as.factor(${dfName}$${yCol})
table(${dfName}$${yCol})

# Advertencia: NO usar regresión lineal lm() con variable 0/1
# modelo_malo <- lm(as.numeric(as.character(${yCol})) ~ ${predList}, data = ${dfName})
# summary(modelo_malo)$r.squared # Produce R2 sin sentido y predicciones <0 o >1`;

    case 4:
      return `# Paso 4: Análisis descriptivo y comparación entre grupo 0 y grupo 1
summary(${dfName})

# Conteos para variables categóricas y variable objetivo:
table(${dfName}$${yCol})
${
  ctx.categoricalCols.length > 0
    ? ctx.categoricalCols.map((c) => `table(${dfName}$${c})`).join('\n')
    : '# Sin variables categóricas seleccionadas'
}

# Comparar promedios de variables numéricas según grupo (0 vs 1):
aggregate(. ~ ${yCol}, data = ${dfName}, FUN = mean, na.rm = TRUE)`;

    case 5:
      return `# Paso 5: Revisar balance de clases y aplicar estrategia SOLO en entrenamiento
prop.table(table(${dfName}$${yCol})) * 100

${
  ctx.balanceMethod === 'none'
    ? '# Sin balanceo aplicado: se usan las frecuencias originales en train.'
    : ctx.balanceMethod === 'undersample'
      ? `# Submuestreo (downSample) SOLO sobre datos de entrenamiento:
set.seed(${ctx.seed})
train_bal <- downSample(x = train_df[, setdiff(names(train_df), "${yCol}")],
                        y = train_df$${yCol}, yname = "${yCol}")`
      : ctx.balanceMethod === 'oversample'
        ? `# Sobremuestreo (upSample) SOLO sobre datos de entrenamiento:
set.seed(${ctx.seed})
train_bal <- upSample(x = train_df[, setdiff(names(train_df), "${yCol}")],
                      y = train_df$${yCol}, yname = "${yCol}")`
        : ctx.balanceMethod === 'smote'
          ? `# SMOTE (casos sintéticos) SOLO sobre datos de entrenamiento:
library(ROSE)
set.seed(${ctx.seed})
train_bal <- ovun.sample(${yCol} ~ ., data = train_df, method = "over")$data`
          : `# Pesos por clase en glm() SOLO durante el entrenamiento:
n_0 <- sum(train_df$${yCol} == 0); n_1 <- sum(train_df$${yCol} == 1)
pesos <- ifelse(train_df$${yCol} == 1, nrow(train_df)/(2*n_1), nrow(train_df)/(2*n_0))`
}`;

    case 6: {
      const catLines = ctx.categoricalCols
        .map((col) => {
          const ref = ctx.referenceCategories[col];
          return `${dfName}$${col} <- as.factor(${dfName}$${col})${
            ref ? `\n${dfName}$${col} <- relevel(${dfName}$${col}, ref = "${ref}")` : ''
          }`;
        })
        .join('\n');
      return `# Paso 6: Convertir códigos categóricos a factor y crear dummies (n - 1 columnas)
${catLines || '# No hay variables categóricas activas'}

# Opción explícita con caret::dummyVars (fullRank = TRUE crea n - 1 columnas):
library(caret)
dmy <- dummyVars(~ ${predList}, data = ${dfName}, fullRank = TRUE)
X_dummies <- data.frame(predict(dmy, newdata = ${dfName}))
datos_prep <- cbind(${yCol} = ${dfName}$${yCol}, X_dummies)`;
    }

    case 7:
      return `# Paso 7: Partición reproducible en Entrenamiento (${Math.round(ctx.trainRatio * 100)}%) y Prueba (${Math.round((1 - ctx.trainRatio) * 100)}%)
library(caret)
set.seed(${ctx.seed})
idx_train <- createDataPartition(datos_prep$${yCol}, p = ${ratioStr}, list = FALSE)

train_df <- datos_prep[idx_train, ]
test_df  <- datos_prep[-idx_train, ]

# Verificar proporción de unos en cada partición:
prop.table(table(train_df$${yCol}))
prop.table(table(test_df$${yCol}))`;

    case 8:
      return `# Paso 8: Ajustar el modelo de Regresión Logística por Máxima Verosimilitud
modelo <- glm(${yCol} ~ .,
              data = ${ctx.balanceMethod === 'none' || ctx.balanceMethod === 'weights' ? 'train_df' : 'train_bal'},
              family = binomial(link = "logit")${ctx.balanceMethod === 'weights' ? ',\n              weights = pesos' : ''})

summary(modelo)      # Coeficientes (z), error estándar, p-value y AIC
exp(coef(modelo))    # Odds Ratios (e^b)
exp(confint.default(modelo)) # Intervalos de confianza 95%`;

    case 9:
      return `# Paso 9: Calcular probabilidades (curva sigmoide) y aplicar punto de corte = ${threshStr}
prob_train <- predict(modelo, newdata = train_df, type = "response")
prob_test  <- predict(modelo, newdata = test_df,  type = "response")

# Convertir probabilidad en clase 0 / 1 con el corte elegido:
pred_test <- ifelse(prob_test >= ${threshStr}, 1, 0)`;

    case 10:
      return `# Paso 10: Matriz de confusión en Entrenamiento y Prueba
library(caret)
pred_train <- factor(ifelse(prob_train >= ${threshStr}, 1, 0), levels = c("0", "1"))
pred_test  <- factor(ifelse(prob_test  >= ${threshStr}, 1, 0), levels = c("0", "1"))

# OJO: En R, table() y confusionMatrix() ponen Predicción en filas y Real en columnas:
table(Prediccion = pred_test, Real = test_df$${yCol})
confusionMatrix(pred_test, test_df$${yCol}, positive = "1")

# Para ver Real en filas y Predicción en columnas (como en esta app):
table(Real = test_df$${yCol}, Prediccion = pred_test)`;

    case 11:
      return `# Paso 11: Curva ROC, AUC y análisis Lift / Ganancia acumulada
library(pROC)
roc_obj <- roc(response = test_df$${yCol}, predictor = prob_test)
auc(roc_obj)
plot(roc_obj, main = "Curva ROC - Datos de Prueba")

# Tabla Lift por deciles:
orden <- order(prob_test, decreasing = TRUE)
positivos_acum <- cumsum(as.numeric(as.character(test_df$${yCol}[orden]))) / sum(test_df$${yCol} == "1")`;

    case 12:
      return `# Paso 12: Optimización de ganancia neta según costos del negocio
cortes <- seq(0.05, 0.95, by = 0.01)
ganancias <- sapply(cortes, function(c) {
  pred <- ifelse(prob_test >= c, 1, 0)
  real <- as.numeric(as.character(test_df$${yCol}))
  tp <- sum(pred == 1 & real == 1)
  fp <- sum(pred == 1 & real == 0)
  fn <- sum(pred == 0 & real == 1)
  tp * beneficio_VP - fp * costo_FP - fn * costo_FN
})
corte_optimo <- cortes[which.max(ganancias)]`;

    case 13:
      return `# Paso 13: Comparar versiones candidatas de modelos
# Comparar AIC (menor es mejor) y desempeño en prueba (F1 clase 1, AUC, Accuracy)
AIC(modelo_v1, modelo_v2)
# En prueba, priorizar F1 de la clase de interés y AUC antes que solo Accuracy`;

    case 14: {
      const fields = Object.entries(ctx.sampleCase)
        .map(([k, v]) => `  ${k} = ${typeof v === 'number' ? v : `"${v}"`}`)
        .join(',\n');
      return `# Paso 14: Predecir un caso nuevo paso a paso (z y probabilidad p)
nuevo_caso <- data.frame(
${fields || '  # variables del nuevo caso'}
)

# Cálculo de z = b0 + b1*X1 + ... y probabilidad p = 1 / (1 + exp(-z)):
z_nuevo <- predict(modelo, newdata = nuevo_caso, type = "link")
p_nuevo <- predict(modelo, newdata = nuevo_caso, type = "response")
clase_final <- ifelse(p_nuevo >= ${threshStr}, 1, 0)`;
    }

    case 15:
      return `# Paso 15: Segmentar la cartera en Riesgo Bajo, Medio y Alto
riesgo <- ifelse(prob_test >= 0.60, "Alto",
          ifelse(prob_test >= 0.30, "Medio", "Bajo"))
table(riesgo)`;

    case 16:
      return `# Paso 16: Exportar resultados finales con probabilidad, predicción y riesgo
resultado_export <- cbind(
  test_df,
  probabilidad = round(prob_test, 4),
  clase_predicha = ifelse(prob_test >= ${threshStr}, 1, 0),
  nivel_riesgo = ifelse(prob_test >= 0.60, "Alto", ifelse(prob_test >= 0.30, "Medio", "Bajo"))
)
write.csv(resultado_export, "predicciones_riesgo.csv", row.names = FALSE)`;

    default:
      return '';
  }
}
