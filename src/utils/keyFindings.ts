import {
  BalanceMethod,
  BusinessContext,
  ConfusionEvaluation,
  DataAnomaly,
  LogisticModelResult,
  ProfitCurvePoint,
  RiskPolicy,
} from '../types/model';
import { GroupComparisonRow } from './dataProfiler';
import {
  formatCurrencyCO,
  formatIntCO,
  formatNumberCO,
  formatPercentCO,
} from './formatters';

export interface KeyFindingInput {
  step: number;
  context: BusinessContext;
  totalRows: number;
  colCount: number;
  anomalies: DataAnomaly[];
  targetCol: string;
  positiveClass: string;
  count0: number;
  count1: number;
  groupComparison: GroupComparisonRow[];
  balanceMethod: BalanceMethod;
  categoricalCols: string[];
  encodedFeatureCount: number;
  trainRatio: number;
  seed: number;
  trainCount: number;
  trainOnes: number;
  testCount: number;
  testOnes: number;
  model: LogisticModelResult;
  threshold: number;
  trainEval: ConfusionEvaluation;
  testEval: ConfusionEvaluation;
  aucTest: number;
  liftAt20?: number;
  bestProfitPoint: ProfitCurvePoint;
  riskPolicy: RiskPolicy;
  riskCounts: { low: number; medium: number; high: number };
}

export function generateKeyFinding(input: KeyFindingInput): {
  text: string;
  tone: 'neutral' | 'good' | 'warning';
} {
  const { step } = input;
  const total = input.count0 + input.count1;
  const pct1 = total > 0 ? input.count1 / total : 0;

  switch (step) {
    case 1: {
      const errorLabel =
        input.context.costoMayor === 'fn'
          ? 'un falso negativo (dejar pasar un caso real)'
          : input.context.costoMayor === 'fp'
            ? 'un falso positivo (generar una falsa alarma)'
            : 'ambos tipos de error de forma equilibrada';
      return {
        text: `El equipo busca responder "${input.context.pregunta}". Como pesa más ${errorLabel}, priorizaremos el F1 y la sensibilidad sobre la accuracy simple.`,
        tone: 'neutral',
      };
    }

    case 2:
      if (input.totalRows === 0) {
        return {
          text: 'No hay datos cargados. Selecciona un caso ejemplo o sube un archivo CSV/Excel para comenzar.',
          tone: 'warning',
        };
      }
      if (input.anomalies.length > 0) {
        const first = input.anomalies[0];
        return {
          text: `Base con ${formatIntCO(input.totalRows)} filas y ${formatIntCO(input.colCount)} columnas. Se detectaron ${formatIntCO(input.anomalies.length)} anomalías de calidad (por ejemplo, ${first.kind.toLowerCase()} en "${first.column}", fila ${first.rowNumber}). Puedes corregirlas aquí antes de modelar.`,
          tone: 'warning',
        };
      }
      return {
        text: `Base auditada con ${formatIntCO(input.totalRows)} filas y ${formatIntCO(input.colCount)} columnas sin datos faltantes ni valores imposibles.`,
        tone: 'good',
      };

    case 3:
      return {
        text: `La variable "${input.targetCol}" quedó codificada como 1 cuando vale "${input.positiveClass}" (${formatIntCO(input.count1)} casos, ${formatPercentCO(pct1, 1)}) y 0 en el resto (${formatIntCO(input.count0)} casos). Usaremos regresión logística para garantizar probabilidades válidas entre 0% y 100%.`,
        tone: 'neutral',
      };

    case 4: {
      const sorted = [...input.groupComparison].sort((a, b) => a.pValue - b.pValue);
      const top = sorted[0];
      if (!top) {
        return {
          text: 'Revisa las frecuencias de las variables categóricas para identificar los segmentos con mayor incidencia del evento.',
          tone: 'neutral',
        };
      }
      return {
        text: `La mayor diferencia entre el grupo 0 y el grupo 1 aparece en "${top.column}": promedio de ${formatNumberCO(top.mean0, 1)} en el grupo 0 frente a ${formatNumberCO(top.mean1, 1)} en el grupo 1.`,
        tone: top.pValue < 0.05 ? 'good' : 'neutral',
      };
    }

    case 5: {
      const minPct = Math.min(pct1, 1 - pct1);
      if (minPct < 0.2) {
        return {
          text: `La clase minoritaria representa solo ${formatPercentCO(minPct, 1)} (< 20%). Se recomienda mantener activo un método de balanceo en entrenamiento (como SMOTE o pesos por clase).`,
          tone: 'warning',
        };
      }
      return {
        text: `Tenemos ${formatIntCO(input.count0)} casos negativos (${formatPercentCO(1 - pct1, 1)}) y ${formatIntCO(input.count1)} positivos (${formatPercentCO(pct1, 1)}). Como la clase de interés supera el 20%, el desbalance es manejable con o sin balanceo.`,
        tone: 'good',
      };
    }

    case 6:
      return {
        text: `Se transformaron ${formatIntCO(input.categoricalCols.length)} variable(s) categórica(s) en columnas dummy (n − 1) y se retiraron sus códigos originales, entregando al modelo ${formatIntCO(input.encodedFeatureCount)} columnas limpias sin duplicación.`,
        tone: 'neutral',
      };

    case 7:
      return {
        text: `Con semilla ${input.seed} y proporción ${Math.round(input.trainRatio * 100)}/${Math.round((1 - input.trainRatio) * 100)}, quedaron ${formatIntCO(input.trainCount)} casos en entrenamiento (${formatPercentCO(input.trainCount ? input.trainOnes / input.trainCount : 0, 1)} de unos) y ${formatIntCO(input.testCount)} en prueba (${formatPercentCO(input.testCount ? input.testOnes / input.testCount : 0, 1)} de unos).`,
        tone: 'good',
      };

    case 8: {
      const sigVars = input.model.coefficients.filter((c) => !c.isIntercept && c.pValue < 0.05);
      const strongest = [...sigVars].sort((a, b) => a.pValue - b.pValue)[0];
      if (!strongest) {
        return {
          text: `El modelo convergió con AIC = ${formatNumberCO(input.model.aic, 1)}, pero ninguna variable alcanzó significancia estadística al 5% (p < 0,05); considera revisar la selección de variables.`,
          tone: 'warning',
        };
      }
      return {
        text: `De ${formatIntCO(input.model.coefficients.length - 1)} términos evaluados, ${formatIntCO(sigVars.length)} son significativos (p < 0,05). El predictor más fuerte es "${strongest.name}" (Odds Ratio = ${formatNumberCO(strongest.oddsRatio, 2)}) y el AIC del modelo es ${formatNumberCO(input.model.aic, 1)}.`,
        tone: 'good',
      };
    }

    case 9:
      return {
        text: `Con el punto de corte en ${formatNumberCO(input.threshold, 2)}, el modelo alcanza en prueba una sensibilidad (recall) de ${formatPercentCO(input.testEval.class1.recall, 1)} y una precisión de ${formatPercentCO(input.testEval.class1.precision, 1)} (F1 = ${formatPercentCO(input.testEval.class1.f1, 1)}).`,
        tone: 'neutral',
      };

    case 10: {
      const paradox = input.testEval.accuracy >= 0.7 && input.testEval.class1.f1 < 0.5;
      if (paradox) {
        return {
          text: `Cuidado: la accuracy en prueba es ${formatPercentCO(input.testEval.accuracy, 1)}, pero el F1 de la clase de interés cae a ${formatPercentCO(input.testEval.class1.f1, 1)}. La accuracy engaña cuando una clase es mayoritaria; ajusta el corte o el balanceo.`,
          tone: 'warning',
        };
      }
      return {
        text: `En prueba (casos nuevos), el modelo acierta el ${formatPercentCO(input.testEval.accuracy, 1)} global (accuracy balanceada ${formatPercentCO(input.testEval.balancedAccuracy, 1)}) con un F1 de ${formatPercentCO(input.testEval.class1.f1, 1)} para la clase positiva.`,
        tone: input.testEval.class1.f1 >= 0.55 ? 'good' : 'neutral',
      };
    }

    case 11:
      return {
        text: `El AUC en prueba es ${formatNumberCO(input.aucTest, 3)}${
          input.liftAt20
            ? ` y al contactar solo el 20% más riesgoso según el modelo logras un Lift de ${formatNumberCO(input.liftAt20, 2)}x frente a elegir clientes al azar`
            : ''
        }.`,
        tone: input.aucTest >= 0.75 ? 'good' : 'neutral',
      };

    case 12:
      return {
        text: `Considerando tus costos y beneficios, el punto de corte que maximiza la ganancia financiera en prueba es ${formatNumberCO(input.bestProfitPoint.threshold, 2)}, generando una ganancia neta estimada de ${formatCurrencyCO(input.bestProfitPoint.profit)}.`,
        tone: 'good',
      };

    case 13:
      return {
        text: `Compara versiones guardadas priorizando el mayor F1 de la clase de interés y mayor AUC en datos de prueba, buscando a la vez un AIC más bajo.`,
        tone: 'neutral',
      };

    case 14:
      return {
        text: `La calculadora transparente descompone cada coeficiente × valor para mostrar cómo nace z y cómo la curva logística lo convierte en una probabilidad de negocio.`,
        tone: 'neutral',
      };

    case 15:
      return {
        text: `La cartera total queda segmentada en ${formatIntCO(input.riskCounts.high)} casos en Riesgo Alto (≥ ${formatPercentCO(input.riskPolicy.highMin, 0)}), ${formatIntCO(input.riskCounts.medium)} en Riesgo Medio y ${formatIntCO(input.riskCounts.low)} en Riesgo Bajo, cada uno con su plan de acción.`,
        tone: input.riskCounts.high > 0 ? 'warning' : 'good',
      };

    case 16:
      return {
        text: `Tu análisis CRISP-DM está completo. Descarga el informe ejecutivo HTML (incluye todo el código R equivalente) y el archivo CSV con probabilidades y niveles de riesgo para el equipo comercial.`,
        tone: 'good',
      };

    default:
      return { text: '', tone: 'neutral' };
  }
}
