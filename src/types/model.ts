export type RawValue = string | number | boolean | null | undefined;
export type RawRow = Record<string, RawValue>;

export type VariableRoleType = 'numeric' | 'categorical';

export interface ColumnProfile {
  name: string;
  inferredType: VariableRoleType;
  userType: VariableRoleType;
  nonMissingCount: number;
  missingCount: number;
  uniqueCount: number;
  uniqueValues: string[];
  sampleValues: string[];
  mean?: number;
  sd?: number;
  median?: number;
  min?: number;
  max?: number;
  q25?: number;
  q75?: number;
}

export interface DataAnomaly {
  id: string;
  rowIndex: number; // 0-based index in active dataset
  rowNumber: number; // 1-based Excel/CSV row (data row)
  column: string;
  valueDisplay: string;
  kind: 'Faltante' | 'Valor imposible';
  detail: string;
}

export interface BusinessContext {
  pregunta: string;
  decision: string;
  costoMayor: 'fn' | 'fp' | 'igual';
  descripcionCostos: string;
  contextoIndustria: string;
}

export type BalanceMethod = 'none' | 'undersample' | 'oversample' | 'smote' | 'weights';

export interface EncodedFeatureInfo {
  featureName: string;
  sourceColumn: string;
  isDummy: boolean;
  categoryValue?: string;
  referenceCategory?: string;
}

export interface PreparedDataset {
  features: EncodedFeatureInfo[];
  featureMatrix: number[][]; // N x K (without intercept)
  y: number[]; // N (0 or 1)
  rowIndices: number[]; // original row indices retained
  droppedRowCount: number;
}

export interface LogisticCoefficient {
  name: string;
  sourceColumn: string;
  isIntercept: boolean;
  isDummy: boolean;
  categoryValue?: string;
  referenceCategory?: string;
  estimate: number;
  stdError: number;
  zValue: number;
  pValue: number;
  oddsRatio: number;
  ciLow: number;
  ciHigh: number;
  collinearDropped?: boolean;
}

export interface LogisticModelResult {
  converged: boolean;
  iterations: number;
  coefficients: LogisticCoefficient[];
  aic: number;
  nullDeviance: number;
  residualDeviance: number;
  logLikelihood: number;
  pseudoR2McFadden: number;
  nObsTrain: number;
  featureNames: string[];
  warnings: string[];
}

export interface ClassMetrics {
  precision: number;
  recall: number;
  f1: number;
  specificity: number;
  support: number;
}

export interface ConfusionEvaluation {
  tn: number;
  fp: number;
  fn: number;
  tp: number;
  total: number;
  accuracy: number;
  errorRate: number;
  balancedAccuracy: number;
  class1: ClassMetrics; // Positive class (1)
  class0: ClassMetrics; // Negative class (0)
  row0Pct: number; // (tn + fp) / total
  row1Pct: number; // (fn + tp) / total
}

export interface RocPoint {
  threshold: number;
  fpr: number; // 1 - specificity
  tpr: number; // recall / sensitivity
}

export interface LiftPoint {
  pctContacted: number; // 0 to 100
  pctPositivesFound: number; // 0 to 100 (model)
  pctRandomFound: number; // 0 to 100 (diagonal)
  lift: number;
  casesCount: number;
  positivesCount: number;
}

export interface ProfitCurvePoint {
  threshold: number;
  profit: number;
  tp: number;
  fp: number;
  fn: number;
  tn: number;
}

export interface ProfitConfig {
  benefitTP: number;
  costFP: number;
  costFN: number;
  benefitTN: number;
}

export interface ModelSnapshot {
  id: string;
  name: string;
  createdAt: string;
  selectedPredictors: string[];
  balanceMethod: BalanceMethod;
  trainRatio: number;
  seed: number;
  threshold: number;
  aic: number;
  aucTest: number;
  trainEval: ConfusionEvaluation;
  testEval: ConfusionEvaluation;
  featureCount: number;
  coefficients: LogisticCoefficient[];
}

export interface RiskPolicy {
  lowMax: number; // p < lowMax => Bajo
  highMin: number; // p >= highMin => Alto
  actionLow: string;
  actionMedium: string;
  actionHigh: string;
}

export interface StepGuideContent {
  stepNumber: number;
  phase: string;
  title: string;
  whatItMeansTitle: string;
  whatItMeansBody: string;
  whatItMeansExample: string;
}
