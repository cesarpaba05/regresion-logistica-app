import { jStat } from 'jstat';
import {
  BalanceMethod,
  ColumnProfile,
  EncodedFeatureInfo,
  LogisticCoefficient,
  LogisticModelResult,
  PreparedDataset,
  RawRow,
} from '../types/model';
import { isMissingValue, toNumericValue } from './dataProfiler';
import { createSeededRng, shuffleWithRng } from './random';

export function prepareDatasetForModel(
  rows: RawRow[],
  profiles: ColumnProfile[],
  targetCol: string,
  positiveClass: string,
  selectedPredictors: string[],
  referenceCategories: Record<string, string>
): PreparedDataset {
  const profileMap = new Map(profiles.map((p) => [p.name, p]));
  const features: EncodedFeatureInfo[] = [];

  for (const col of selectedPredictors) {
    if (col === targetCol) continue;
    const prof = profileMap.get(col);
    if (!prof) continue;

    if (prof.userType === 'categorical') {
      const levels = prof.uniqueValues;
      if (levels.length <= 1) continue;
      const refCat =
        referenceCategories[col] && levels.includes(referenceCategories[col])
          ? referenceCategories[col]
          : levels[0];
      for (const lvl of levels) {
        if (lvl === refCat) continue;
        features.push({
          featureName: `${col}_${lvl}`,
          sourceColumn: col,
          isDummy: true,
          categoryValue: lvl,
          referenceCategory: refCat,
        });
      }
    } else {
      features.push({
        featureName: col,
        sourceColumn: col,
        isDummy: false,
      });
    }
  }

  const featureMatrix: number[][] = [];
  const y: number[] = [];
  const rowIndices: number[] = [];
  let droppedRowCount = 0;

  rows.forEach((row, idx) => {
    const tVal = row[targetCol];
    if (isMissingValue(tVal)) {
      droppedRowCount++;
      return;
    }

    const rowVec: number[] = [];
    let hasInvalid = false;

    for (const col of selectedPredictors) {
      if (col === targetCol) continue;
      const val = row[col];
      if (isMissingValue(val)) {
        hasInvalid = true;
        break;
      }
      const prof = profileMap.get(col);
      if (prof?.userType === 'numeric') {
        if (toNumericValue(val) === null) {
          hasInvalid = true;
          break;
        }
      }
    }

    if (hasInvalid) {
      droppedRowCount++;
      return;
    }

    for (const feat of features) {
      const rawVal = row[feat.sourceColumn];
      if (feat.isDummy) {
        rowVec.push(String(rawVal).trim() === feat.categoryValue ? 1 : 0);
      } else {
        rowVec.push(toNumericValue(rawVal) ?? 0);
      }
    }

    const yVal = String(tVal).trim() === positiveClass ? 1 : 0;
    featureMatrix.push(rowVec);
    y.push(yVal);
    rowIndices.push(idx);
  });

  return {
    features,
    featureMatrix,
    y,
    rowIndices,
    droppedRowCount,
  };
}

export function stratifiedTrainTestSplit(
  y: number[],
  trainRatio: number,
  seed: number
): { trainIdx: number[]; testIdx: number[] } {
  const rng = createSeededRng(seed);
  const idx0: number[] = [];
  const idx1: number[] = [];

  y.forEach((val, i) => {
    if (val === 1) idx1.push(i);
    else idx0.push(i);
  });

  const shuffled0 = shuffleWithRng(idx0, rng);
  const shuffled1 = shuffleWithRng(idx1, rng);

  const nTrain0 = Math.max(1, Math.min(shuffled0.length - 1, Math.round(shuffled0.length * trainRatio)));
  const nTrain1 = Math.max(1, Math.min(shuffled1.length - 1, Math.round(shuffled1.length * trainRatio)));

  const trainIdx = [...shuffled0.slice(0, nTrain0), ...shuffled1.slice(0, nTrain1)].sort((a, b) => a - b);
  const testIdx = [...shuffled0.slice(nTrain0), ...shuffled1.slice(nTrain1)].sort((a, b) => a - b);

  return { trainIdx, testIdx };
}

export interface BalancedTrainingData {
  X: number[][];
  y: number[];
  weights: number[];
  originalCount0: number;
  originalCount1: number;
  finalCount0: number;
  finalCount1: number;
}

export function applyTrainingBalance(
  XTrain: number[][],
  yTrain: number[],
  features: EncodedFeatureInfo[],
  method: BalanceMethod,
  seed: number
): BalancedTrainingData {
  const rng = createSeededRng(seed + 991);
  const idx0: number[] = [];
  const idx1: number[] = [];
  yTrain.forEach((val, i) => {
    if (val === 1) idx1.push(i);
    else idx0.push(i);
  });

  const originalCount0 = idx0.length;
  const originalCount1 = idx1.length;

  if (method === 'none' || originalCount0 === 0 || originalCount1 === 0) {
    return {
      X: XTrain,
      y: yTrain,
      weights: yTrain.map(() => 1),
      originalCount0,
      originalCount1,
      finalCount0: originalCount0,
      finalCount1: originalCount1,
    };
  }

  if (method === 'weights') {
    const total = yTrain.length;
    const w0 = total / (2 * originalCount0);
    const w1 = total / (2 * originalCount1);
    return {
      X: XTrain,
      y: yTrain,
      weights: yTrain.map((val) => (val === 1 ? w1 : w0)),
      originalCount0,
      originalCount1,
      finalCount0: originalCount0,
      finalCount1: originalCount1,
    };
  }

  const minorityIs1 = originalCount1 <= originalCount0;
  const majIdx = minorityIs1 ? idx0 : idx1;
  const minIdx = minorityIs1 ? idx1 : idx0;
  const minLabel = minorityIs1 ? 1 : 0;
  const majLabel = minorityIs1 ? 0 : 1;

  if (method === 'undersample') {
    const sampledMaj = shuffleWithRng(majIdx, rng).slice(0, minIdx.length);
    const combined = shuffleWithRng([...sampledMaj, ...minIdx], rng);
    return {
      X: combined.map((i) => XTrain[i]),
      y: combined.map((i) => yTrain[i]),
      weights: combined.map(() => 1),
      originalCount0,
      originalCount1,
      finalCount0: minIdx.length,
      finalCount1: minIdx.length,
    };
  }

  if (method === 'oversample') {
    const needed = majIdx.length - minIdx.length;
    const extra: number[] = [];
    for (let k = 0; k < needed; k++) {
      extra.push(minIdx[Math.floor(rng() * minIdx.length)]);
    }
    const combined = shuffleWithRng([...majIdx, ...minIdx, ...extra], rng);
    return {
      X: combined.map((i) => XTrain[i]),
      y: combined.map((i) => yTrain[i]),
      weights: combined.map(() => 1),
      originalCount0,
      originalCount1,
      finalCount0: majIdx.length,
      finalCount1: majIdx.length,
    };
  }

  // SMOTE: generar casos sintéticos interpolando vecinos cercanos de la clase minoritaria
  const p = features.length;
  const means = new Array(p).fill(0);
  const sds = new Array(p).fill(1);
  if (minIdx.length > 1) {
    for (let j = 0; j < p; j++) {
      const m = minIdx.reduce((acc, idx) => acc + XTrain[idx][j], 0) / minIdx.length;
      const v =
        minIdx.reduce((acc, idx) => acc + (XTrain[idx][j] - m) ** 2, 0) /
        Math.max(1, minIdx.length - 1);
      means[j] = m;
      sds[j] = v > 1e-9 ? Math.sqrt(v) : 1;
    }
  }

  const needed = majIdx.length - minIdx.length;
  const syntheticX: number[][] = [];
  const kNeighbors = Math.min(5, Math.max(1, minIdx.length - 1));

  for (let s = 0; s < needed; s++) {
    const baseIdx = minIdx[Math.floor(rng() * minIdx.length)];
    const baseVec = XTrain[baseIdx];

    if (minIdx.length <= 1) {
      syntheticX.push([...baseVec]);
      continue;
    }

    const distances = minIdx
      .filter((idx) => idx !== baseIdx)
      .map((otherIdx) => {
        const otherVec = XTrain[otherIdx];
        let d2 = 0;
        for (let j = 0; j < p; j++) {
          const diff = (baseVec[j] - otherVec[j]) / sds[j];
          d2 += diff * diff;
        }
        return { otherIdx, d2 };
      })
      .sort((a, b) => a.d2 - b.d2);

    const chosenNeighborIdx =
      distances[Math.floor(rng() * Math.min(kNeighbors, distances.length))].otherIdx;
    const neighborVec = XTrain[chosenNeighborIdx];

    const u = rng();
    const synth = new Array(p).fill(0);
    for (let j = 0; j < p; j++) {
      if (features[j]?.isDummy) {
        // Mantener valores discretos válidos para dummies
        synth[j] = rng() < 0.5 ? baseVec[j] : neighborVec[j];
      } else {
        synth[j] = baseVec[j] + u * (neighborVec[j] - baseVec[j]);
      }
    }
    syntheticX.push(synth);
  }

  const outX: number[][] = [];
  const outY: number[] = [];
  majIdx.forEach((i) => {
    outX.push(XTrain[i]);
    outY.push(majLabel);
  });
  minIdx.forEach((i) => {
    outX.push(XTrain[i]);
    outY.push(minLabel);
  });
  syntheticX.forEach((vec) => {
    outX.push(vec);
    outY.push(minLabel);
  });

  const order = shuffleWithRng(
    outX.map((_, i) => i),
    rng
  );

  return {
    X: order.map((i) => outX[i]),
    y: order.map((i) => outY[i]),
    weights: order.map(() => 1),
    originalCount0,
    originalCount1,
    finalCount0: majIdx.length,
    finalCount1: majIdx.length,
  };
}

/**
 * Resuelve sistema lineal A * x = b e invierte A mediante Gauss-Jordan con pivoteo parcial.
 */
function solveAndInvert(
  A: number[][],
  b: number[]
): { solution: number[]; inverse: number[][]; singular: boolean } {
  const n = A.length;
  const aug: number[][] = A.map((row, i) => [
    ...row,
    b[i],
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)),
  ]);

  let singular = false;

  for (let col = 0; col < n; col++) {
    let pivotRow = col;
    let maxVal = Math.abs(aug[col][col]);
    for (let r = col + 1; r < n; r++) {
      const val = Math.abs(aug[r][col]);
      if (val > maxVal) {
        maxVal = val;
        pivotRow = r;
      }
    }

    if (maxVal < 1e-12) {
      singular = true;
      aug[col][col] = aug[col][col] >= 0 ? 1e-8 : -1e-8;
    }

    if (pivotRow !== col) {
      const tmp = aug[col];
      aug[col] = aug[pivotRow];
      aug[pivotRow] = tmp;
    }

    const pivot = aug[col][col];
    for (let j = col; j < aug[col].length; j++) {
      aug[col][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      if (factor === 0) continue;
      for (let j = col; j < aug[r].length; j++) {
        aug[r][j] -= factor * aug[col][j];
      }
    }
  }

  const solution = aug.map((row) => row[n]);
  const inverse = aug.map((row) => row.slice(n + 1));
  return { solution, inverse, singular };
}

export function sigmoid(z: number): number {
  if (z >= 35) return 1 - 1e-15;
  if (z <= -35) return 1e-15;
  return 1 / (1 + Math.exp(-z));
}

function computeDeviance(y: number[], mu: number[], weights: number[]): number {
  let dev = 0;
  for (let i = 0; i < y.length; i++) {
    const p = Math.min(1 - 1e-15, Math.max(1e-15, mu[i]));
    const yi = y[i];
    const wi = weights[i];
    if (yi === 1) {
      dev += -2 * wi * Math.log(p);
    } else {
      dev += -2 * wi * Math.log(1 - p);
    }
  }
  return dev;
}

/**
 * Regresión Logística por Máxima Verosimilitud (IRLS / Newton-Raphson),
 * equivalente a glm(y ~ ..., family = binomial(link = "logit")) en R.
 */
export function fitLogisticRegressionIRLS(
  XRaw: number[][],
  y: number[],
  features: EncodedFeatureInfo[],
  weights?: number[]
): LogisticModelResult {
  const n = XRaw.length;
  const warnings: string[] = [];

  if (n === 0) {
    return {
      converged: false,
      iterations: 0,
      coefficients: [],
      aic: NaN,
      nullDeviance: NaN,
      residualDeviance: NaN,
      logLikelihood: NaN,
      pseudoR2McFadden: NaN,
      nObsTrain: 0,
      featureNames: [],
      warnings: ['No hay observaciones válidas para entrenar el modelo.'],
    };
  }

  const w = weights && weights.length === n ? weights : new Array(n).fill(1);
  const p = features.length + 1; // +1 para el intercepto

  // Matriz de diseño X con columna de 1s al inicio
  const X: number[][] = XRaw.map((row) => [1, ...row]);

  // Inicialización estilo R binomial()$initialize
  const sumW = w.reduce((a, b) => a + b, 0);
  const sumWY = w.reduce((a, wi, i) => a + wi * y[i], 0);
  const yBar = Math.min(1 - 1e-6, Math.max(1e-6, sumWY / sumW));

  let mu = y.map((yi, i) => (w[i] * yi + 0.5) / (w[i] + 1));
  let eta = mu.map((m) => Math.log(m / (1 - m)));

  let beta = new Array(p).fill(0);
  beta[0] = Math.log(yBar / (1 - yBar));

  const nullDeviance = computeDeviance(
    y,
    new Array(n).fill(yBar),
    w
  );
  let oldDev = computeDeviance(y, y.map((_, i) => sigmoid(eta[i])), w);

  let converged = false;
  let iterations = 0;
  let finalInverse: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  let hadSingularity = false;

  const MAX_ITER = 50;
  const TOL = 1e-8;

  for (let iter = 1; iter <= MAX_ITER; iter++) {
    iterations = iter;

    // Calcular pesos de trabajo W y respuesta de trabajo z
    const XtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
    const XtWz: number[] = new Array(p).fill(0);

    for (let i = 0; i < n; i++) {
      const m = Math.min(1 - 1e-12, Math.max(1e-12, mu[i]));
      const varMu = m * (1 - m);
      const workW = Math.max(1e-12, w[i] * varMu);
      const workZ = eta[i] + (y[i] - m) / varMu;
      const xi = X[i];

      for (let j = 0; j < p; j++) {
        const xijW = xi[j] * workW;
        XtWz[j] += xijW * workZ;
        for (let k = j; k < p; k++) {
          XtWX[j][k] += xijW * xi[k];
        }
      }
    }

    for (let j = 0; j < p; j++) {
      for (let k = 0; k < j; k++) {
        XtWX[j][k] = XtWX[k][j];
      }
    }

    const { solution: betaNew, inverse, singular } = solveAndInvert(XtWX, XtWz);
    if (singular) hadSingularity = true;
    finalInverse = inverse;

    // Step-halving si la devianza aumenta o hay valores no finitos
    let stepBeta = betaNew;
    let stepEta = X.map((xi) => xi.reduce((acc, v, j) => acc + v * stepBeta[j], 0));
    let stepMu = stepEta.map(sigmoid);
    let newDev = computeDeviance(y, stepMu, w);

    let halving = 0;
    while ((!Number.isFinite(newDev) || newDev > oldDev + 1e-4) && halving < 8 && iter > 1) {
      stepBeta = beta.map((bOld, j) => 0.5 * (bOld + stepBeta[j]));
      stepEta = X.map((xi) => xi.reduce((acc, v, j) => acc + v * stepBeta[j], 0));
      stepMu = stepEta.map(sigmoid);
      newDev = computeDeviance(y, stepMu, w);
      halving++;
    }

    const relChange = Math.abs(newDev - oldDev) / (Math.abs(newDev) + 0.1);
    const maxBetaDiff = Math.max(...stepBeta.map((bNew, j) => Math.abs(bNew - beta[j])));

    beta = stepBeta;
    eta = stepEta;
    mu = stepMu;
    oldDev = newDev;

    if (relChange < TOL && maxBetaDiff < 1e-6) {
      converged = true;
      break;
    }
  }

  // Recalcular matriz de información de Fisher exacta en el beta final
  const finalXtWX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    const m = Math.min(1 - 1e-12, Math.max(1e-12, mu[i]));
    const workW = Math.max(1e-12, w[i] * m * (1 - m));
    const xi = X[i];
    for (let j = 0; j < p; j++) {
      const xijW = xi[j] * workW;
      for (let k = j; k < p; k++) {
        finalXtWX[j][k] += xijW * xi[k];
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) {
      finalXtWX[j][k] = finalXtWX[k][j];
    }
  }
  const { inverse: covMatrix } = solveAndInvert(finalXtWX, new Array(p).fill(0));
  finalInverse = covMatrix;

  const residualDeviance = oldDev;
  const logLikelihood = -0.5 * residualDeviance;
  const aic = residualDeviance + 2 * p;
  const pseudoR2McFadden = nullDeviance > 0 ? 1 - residualDeviance / nullDeviance : 0;

  if (hadSingularity) {
    warnings.push(
      'Se detectó colinealidad o separación casi perfecta en alguna variable; revisa si hay predictores redundantes.'
    );
  }
  if (!converged) {
    warnings.push(
      'El algoritmo alcanzó el máximo de iteraciones. Puede haber separación casi perfecta entre clases.'
    );
  }

  const coefficients: LogisticCoefficient[] = [];

  for (let j = 0; j < p; j++) {
    const est = beta[j];
    const variance = Math.max(1e-16, finalInverse[j][j]);
    const se = Math.sqrt(variance);
    const zVal = est / se;
    const pVal = 2 * (1 - jStat.normal.cdf(Math.abs(zVal), 0, 1));
    const or = Math.exp(Math.min(30, Math.max(-30, est)));
    const ciLow = Math.exp(Math.min(30, Math.max(-30, est - 1.96 * se)));
    const ciHigh = Math.exp(Math.min(30, Math.max(-30, est + 1.96 * se)));

    if (j === 0) {
      coefficients.push({
        name: '(Intercept)',
        sourceColumn: '(Intercept)',
        isIntercept: true,
        isDummy: false,
        estimate: est,
        stdError: se,
        zValue: zVal,
        pValue: pVal,
        oddsRatio: or,
        ciLow,
        ciHigh,
      });
    } else {
      const feat = features[j - 1];
      coefficients.push({
        name: feat.featureName,
        sourceColumn: feat.sourceColumn,
        isIntercept: false,
        isDummy: feat.isDummy,
        categoryValue: feat.categoryValue,
        referenceCategory: feat.referenceCategory,
        estimate: est,
        stdError: se,
        zValue: zVal,
        pValue: pVal,
        oddsRatio: or,
        ciLow,
        ciHigh,
      });
    }
  }

  return {
    converged,
    iterations,
    coefficients,
    aic,
    nullDeviance,
    residualDeviance,
    logLikelihood,
    pseudoR2McFadden,
    nObsTrain: n,
    featureNames: features.map((f) => f.featureName),
    warnings,
  };
}

export function predictProbabilities(
  XRaw: number[][],
  coefficients: LogisticCoefficient[]
): { zValues: number[]; probs: number[] } {
  const b0 = coefficients[0]?.estimate ?? 0;
  const betas = coefficients.slice(1).map((c) => c.estimate);

  const zValues: number[] = [];
  const probs: number[] = [];

  for (const row of XRaw) {
    let z = b0;
    for (let j = 0; j < betas.length; j++) {
      z += betas[j] * (row[j] ?? 0);
    }
    zValues.push(z);
    probs.push(sigmoid(z));
  }

  return { zValues, probs };
}

/**
 * Calcula una regresión lineal OLS rápida contra Y (0/1) para demostrar en el Paso 3
 * por qué NO se debe usar regresión lineal en variables dicotómicas.
 */
export function computeLinearRegressionWarningMetrics(
  XRaw: number[][],
  y: number[]
): { rSquared: number; minPred: number; maxPred: number; outOfBoundsCount: number } {
  const n = XRaw.length;
  if (n < 3 || XRaw[0].length === 0) {
    return { rSquared: 0, minPred: 0, maxPred: 1, outOfBoundsCount: 0 };
  }
  const X = XRaw.map((r) => [1, ...r]);
  const p = X[0].length;
  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  const XtY: number[] = new Array(p).fill(0);

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      XtY[j] += X[i][j] * y[i];
      for (let k = j; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }
  for (let j = 0; j < p; j++) {
    for (let k = 0; k < j; k++) XtX[j][k] = XtX[k][j];
  }
  const { solution: beta } = solveAndInvert(XtX, XtY);
  const preds = X.map((r) => r.reduce((acc, v, j) => acc + v * beta[j], 0));
  const yMean = y.reduce((a, b) => a + b, 0) / n;
  const sst = y.reduce((acc, yi) => acc + (yi - yMean) ** 2, 0);
  const sse = y.reduce((acc, yi, i) => acc + (yi - preds[i]) ** 2, 0);
  const rSquared = sst > 0 ? 1 - sse / sst : 0;
  const minPred = Math.min(...preds);
  const maxPred = Math.max(...preds);
  const outOfBoundsCount = preds.filter((pr) => pr < 0 || pr > 1).length;

  return { rSquared, minPred, maxPred, outOfBoundsCount };
}
