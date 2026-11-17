import {
  ConfusionEvaluation,
  LiftPoint,
  LogisticCoefficient,
  ProfitConfig,
  ProfitCurvePoint,
  RocPoint,
} from '../types/model';
import { formatNumberCO } from './formatters';

export function evaluateConfusionMatrix(
  yTrue: number[],
  probs: number[],
  threshold: number
): ConfusionEvaluation {
  let tn = 0;
  let fp = 0;
  let fn = 0;
  let tp = 0;

  for (let i = 0; i < yTrue.length; i++) {
    const actual = yTrue[i];
    const pred = probs[i] >= threshold ? 1 : 0;
    if (actual === 0 && pred === 0) tn++;
    else if (actual === 0 && pred === 1) fp++;
    else if (actual === 1 && pred === 0) fn++;
    else tp++;
  }

  const total = tn + fp + fn + tp;
  const accuracy = total > 0 ? (tp + tn) / total : 0;
  const errorRate = total > 0 ? (fp + fn) / total : 0;

  // Métricas Clase 1 (Positiva)
  const prec1 = tp + fp > 0 ? tp / (tp + fp) : 0;
  const rec1 = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1_1 = prec1 + rec1 > 0 ? (2 * prec1 * rec1) / (prec1 + rec1) : 0;
  const spec1 = tn + fp > 0 ? tn / (tn + fp) : 0;

  // Métricas Clase 0 (Negativa)
  const prec0 = tn + fn > 0 ? tn / (tn + fn) : 0;
  const rec0 = tn + fp > 0 ? tn / (tn + fp) : 0; // especificidad de 1 = sensibilidad de 0
  const f1_0 = prec0 + rec0 > 0 ? (2 * prec0 * rec0) / (prec0 + rec0) : 0;
  const spec0 = tp + fn > 0 ? tp / (tp + fn) : 0;

  const balancedAccuracy = (rec1 + spec1) / 2;

  return {
    tn,
    fp,
    fn,
    tp,
    total,
    accuracy,
    errorRate,
    balancedAccuracy,
    class1: {
      precision: prec1,
      recall: rec1,
      f1: f1_1,
      specificity: spec1,
      support: tp + fn,
    },
    class0: {
      precision: prec0,
      recall: rec0,
      f1: f1_0,
      specificity: spec0,
      support: tn + fp,
    },
    row0Pct: total > 0 ? (tn + fp) / total : 0,
    row1Pct: total > 0 ? (fn + tp) / total : 0,
  };
}

export function computeRocCurve(
  yTrue: number[],
  probs: number[]
): { points: RocPoint[]; auc: number } {
  const totalPos = yTrue.filter((y) => y === 1).length;
  const totalNeg = yTrue.length - totalPos;
  if (totalPos === 0 || totalNeg === 0) {
    return {
      points: [
        { threshold: 1, fpr: 0, tpr: 0 },
        { threshold: 0, fpr: 1, tpr: 1 },
      ],
      auc: 0.5,
    };
  }

  const pairs = yTrue
    .map((y, i) => ({ y, p: probs[i] }))
    .sort((a, b) => b.p - a.p);

  const points: RocPoint[] = [{ threshold: 1.0001, fpr: 0, tpr: 0 }];
  let tp = 0;
  let fp = 0;

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].y === 1) tp++;
    else fp++;
    // Solo agregar punto cuando cambia la probabilidad o al final
    if (i === pairs.length - 1 || pairs[i].p !== pairs[i + 1].p) {
      points.push({
        threshold: pairs[i].p,
        fpr: fp / totalNeg,
        tpr: tp / totalPos,
      });
    }
  }

  // Asegurar cierre en (1, 1)
  const last = points[points.length - 1];
  if (last.fpr < 1 || last.tpr < 1) {
    points.push({ threshold: 0, fpr: 1, tpr: 1 });
  }

  let auc = 0;
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].fpr - points[i - 1].fpr;
    const avgY = (points[i].tpr + points[i - 1].tpr) / 2;
    auc += dx * avgY;
  }

  return { points, auc };
}

export function computeLiftCurve(yTrue: number[], probs: number[]): LiftPoint[] {
  const n = yTrue.length;
  const totalPos = yTrue.filter((y) => y === 1).length;
  if (n === 0 || totalPos === 0) return [];

  const sorted = yTrue
    .map((y, i) => ({ y, p: probs[i] }))
    .sort((a, b) => b.p - a.p);

  const points: LiftPoint[] = [
    {
      pctContacted: 0,
      pctPositivesFound: 0,
      pctRandomFound: 0,
      lift: 1,
      casesCount: 0,
      positivesCount: 0,
    },
  ];

  for (let pct = 5; pct <= 100; pct += 5) {
    const cutoff = Math.max(1, Math.round((pct / 100) * n));
    const slice = sorted.slice(0, cutoff);
    const posFound = slice.filter((s) => s.y === 1).length;
    const pctPos = (posFound / totalPos) * 100;
    const lift = pct > 0 ? pctPos / pct : 1;

    points.push({
      pctContacted: pct,
      pctPositivesFound: Math.round(pctPos * 10) / 10,
      pctRandomFound: pct,
      lift: Math.round(lift * 100) / 100,
      casesCount: cutoff,
      positivesCount: posFound,
    });
  }

  return points;
}

export function computeProfitCurve(
  yTrue: number[],
  probs: number[],
  config: ProfitConfig
): { points: ProfitCurvePoint[]; bestPoint: ProfitCurvePoint } {
  const points: ProfitCurvePoint[] = [];
  let bestPoint: ProfitCurvePoint | null = null;

  for (let step = 5; step <= 95; step++) {
    const threshold = step / 100;
    const evalRes = evaluateConfusionMatrix(yTrue, probs, threshold);
    const profit =
      evalRes.tp * config.benefitTP +
      evalRes.tn * config.benefitTN -
      evalRes.fp * config.costFP -
      evalRes.fn * config.costFN;

    const pt: ProfitCurvePoint = {
      threshold,
      profit,
      tp: evalRes.tp,
      fp: evalRes.fp,
      fn: evalRes.fn,
      tn: evalRes.tn,
    };
    points.push(pt);

    if (!bestPoint || pt.profit > bestPoint.profit) {
      bestPoint = pt;
    }
  }

  return {
    points,
    bestPoint: bestPoint ?? {
      threshold: 0.5,
      profit: 0,
      tp: 0,
      fp: 0,
      fn: 0,
      tn: 0,
    },
  };
}

export function interpretCoefficientPlainSpanish(
  coef: LogisticCoefficient,
  targetOutcomeName: string
): string {
  if (coef.isIntercept) {
    return `Valor base (log-odds) cuando todas las variables numéricas valen 0 y las categóricas están en su categoría de referencia.`;
  }

  const sigNote =
    coef.pValue < 0.05
      ? 'Efecto estadísticamente significativo (p < 0,05).'
      : 'No significativo estadísticamente al 5% (p ≥ 0,05); interpretar con cautela.';

  const or = coef.oddsRatio;
  const pctChange = Math.abs(or - 1) * 100;
  const direction = or >= 1 ? 'aumenta' : 'reduce';

  if (coef.isDummy) {
    return `Comparado con la referencia (${coef.sourceColumn} = ${coef.referenceCategory}), tener ${coef.sourceColumn} = ${coef.categoryValue} ${direction} las chances de "${targetOutcomeName}" en un ${formatNumberCO(pctChange, 1)}% (OR = ${formatNumberCO(or, 2)}). ${sigNote}`;
  }

  const lower = coef.sourceColumn.toLowerCase();
  if (lower.includes('igual_dueno')) {
    return `Cada año adicional con el mismo dueño ${direction} las chances de "${targetOutcomeName}" en un ${formatNumberCO(pctChange, 1)}% (OR = ${formatNumberCO(or, 2)}). ${sigNote}`;
  }
  if (lower.includes('agnos') || lower.includes('anos')) {
    return `Cada año adicional en la dirección actual ${direction} las chances de "${targetOutcomeName}" en un ${formatNumberCO(pctChange, 1)}% (OR = ${formatNumberCO(or, 2)}). ${sigNote}`;
  }

  return `Cada unidad adicional de "${coef.sourceColumn}" ${direction} las chances de "${targetOutcomeName}" en un ${formatNumberCO(pctChange, 1)}% (OR = ${formatNumberCO(or, 2)}). ${sigNote}`;
}
