import React, { useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  FileSpreadsheet,
  Menu,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { EMBEDDED_DATASETS } from './data/embeddedDatasets';
import {
  BalanceMethod,
  BusinessContext,
  ModelSnapshot,
  ProfitConfig,
  RawRow,
  RiskPolicy,
  VariableRoleType,
} from './types/model';
import {
  computeGroupComparison,
  detectDataAnomalies,
  isMissingValue,
  parseUploadedDataset,
  profileDataset,
  toNumericValue,
} from './utils/dataProfiler';
import {
  applyTrainingBalance,
  fitLogisticRegressionIRLS,
  predictProbabilities,
  prepareDatasetForModel,
  stratifiedTrainTestSplit,
} from './utils/logisticRegression';
import {
  computeLiftCurve,
  computeProfitCurve,
  computeRocCurve,
  evaluateConfusionMatrix,
} from './utils/evaluation';
import {
  ScoredExportRow,
  buildHtmlReport,
  buildScoredCsv,
  triggerDownload,
} from './utils/exporters';
import { generateKeyFinding } from './utils/keyFindings';
import { RCodeContext, generateRCodeForStep } from './utils/rCodeGenerator';
import { STEP_GUIDES } from './utils/stepGuides';
import {
  KeyFindingBox,
  RCodeCollapsible,
  StepFooterNav,
  StepHeader,
} from './components/StepChrome';
import {
  Step1Business,
  Step2DataQuality,
  Step3Target,
  Step4Descriptive,
} from './components/steps/Steps1to4';
import {
  Step5ClassBalance,
  Step6Preparation,
  Step7Split,
  Step8Model,
} from './components/steps/Steps5to8';
import {
  Step10ConfusionMatrix,
  Step11RocLift,
  Step12Profit,
  Step9SCurve,
} from './components/steps/Steps9to12';
import {
  Step13CompareModels,
  Step14IndividualPrediction,
  Step15BusinessActions,
  Step16Export,
} from './components/steps/Steps13to16';

const INITIAL_SPEC = EMBEDDED_DATASETS.cartera;

function buildDefaultPredictors(rows: RawRow[], targetCol: string): string[] {
  if (rows.length === 0) return [];
  return Object.keys(rows[0]).filter((c) => c !== targetCol);
}

function buildDefaultUserTypes(rows: RawRow[]): Record<string, VariableRoleType> {
  const profs = profileDataset(rows);
  const map: Record<string, VariableRoleType> = {};
  profs.forEach((p) => {
    map[p.name] = p.userType;
  });
  return map;
}

function buildDefaultRefCategories(
  rows: RawRow[],
  userTypes: Record<string, VariableRoleType>
): Record<string, string> {
  const profs = profileDataset(rows, userTypes);
  const map: Record<string, string> = {};
  profs.forEach((p) => {
    if (p.uniqueValues.length > 0) {
      map[p.name] = p.uniqueValues[0];
    }
  });
  return map;
}

export default function App() {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [caseMenuOpen, setCaseMenuOpen] = useState(false);
  const topFileInputRef = useRef<HTMLInputElement | null>(null);

  // Estado principal del dataset y configuración CRISP-DM
  const [datasetId, setDatasetId] = useState<string>(INITIAL_SPEC.shortName);
  const [datasetLabel, setDatasetLabel] = useState<string>(INITIAL_SPEC.label);
  const [fileName, setFileName] = useState<string>(INITIAL_SPEC.fileName);
  const [rows, setRows] = useState<RawRow[]>(() => INITIAL_SPEC.rows);

  const [businessContext, setBusinessContext] = useState<BusinessContext>(
    () => INITIAL_SPEC.defaultContext
  );
  const [targetCol, setTargetCol] = useState<string>(INITIAL_SPEC.defaultTarget);
  const [positiveClass, setPositiveClass] = useState<string>(INITIAL_SPEC.defaultPositiveClass);

  const [userTypes, setUserTypes] = useState<Record<string, VariableRoleType>>(() =>
    buildDefaultUserTypes(INITIAL_SPEC.rows)
  );
  const [selectedPredictors, setSelectedPredictors] = useState<string[]>(() =>
    buildDefaultPredictors(INITIAL_SPEC.rows, INITIAL_SPEC.defaultTarget)
  );
  const [referenceCategories, setReferenceCategories] = useState<Record<string, string>>(() =>
    buildDefaultRefCategories(INITIAL_SPEC.rows, buildDefaultUserTypes(INITIAL_SPEC.rows))
  );

  const [balanceMethod, setBalanceMethod] = useState<BalanceMethod>('none');
  const [trainRatio, setTrainRatio] = useState<number>(0.75);
  const [seed, setSeed] = useState<number>(123);
  const [threshold, setThreshold] = useState<number>(0.5);

  const [profitConfig, setProfitConfig] = useState<ProfitConfig>(
    () => INITIAL_SPEC.defaultProfit
  );
  const [sampleCase, setSampleCase] = useState<Record<string, string | number>>(
    () => INITIAL_SPEC.defaultSampleCase
  );
  const [riskPolicy, setRiskPolicy] = useState<RiskPolicy>({
    lowMax: 0.3,
    highMin: 0.6,
    actionLow: 'Facturación normal y seguimiento estándar sin contacto adicional.',
    actionMedium:
      'Enviar recordatorio automático 5 días antes del vencimiento y ofrecer descuento por pronto pago.',
    actionHigh:
      'Cobro preventivo telefónico inmediato, revisión de cupo de crédito y pago anticipado para nuevos despachos.',
  });

  const [snapshots, setSnapshots] = useState<ModelSnapshot[]>([]);

  // Cargar una de las 2 bases incrustadas
  const handleLoadEmbedded = (id: 'cartera' | 'satisfaccion') => {
    const spec = EMBEDDED_DATASETS[id];
    const nextTypes = buildDefaultUserTypes(spec.rows);
    setDatasetId(spec.shortName);
    setDatasetLabel(spec.label);
    setFileName(spec.fileName);
    setRows(spec.rows);
    setBusinessContext(spec.defaultContext);
    setTargetCol(spec.defaultTarget);
    setPositiveClass(spec.defaultPositiveClass);
    setUserTypes(nextTypes);
    setSelectedPredictors(buildDefaultPredictors(spec.rows, spec.defaultTarget));
    setReferenceCategories(buildDefaultRefCategories(spec.rows, nextTypes));
    setBalanceMethod('none');
    setTrainRatio(0.75);
    setSeed(123);
    setThreshold(0.5);
    setProfitConfig(spec.defaultProfit);
    setSampleCase(spec.defaultSampleCase);
    setSnapshots([]);
    setCaseMenuOpen(false);
  };

  // Cargar CSV o XLSX propio del usuario
  const handleUploadRows = (uploadedRows: RawRow[], uploadedFileName: string) => {
    if (uploadedRows.length === 0) return;
    const cols = Object.keys(uploadedRows[0]);
    const profs = profileDataset(uploadedRows);
    const binaryTarget =
      profs.find((p) => p.uniqueCount === 2)?.name ?? cols[cols.length - 1] ?? '';
    const targetProf = profs.find((p) => p.name === binaryTarget);
    const posVal =
      targetProf?.uniqueValues.includes('1')
        ? '1'
        : targetProf?.uniqueValues[targetProf.uniqueValues.length - 1] ?? '1';

    const nextTypes = buildDefaultUserTypes(uploadedRows);
    const nextSample: Record<string, string | number> = {};
    profs.forEach((p) => {
      if (p.name === binaryTarget) return;
      nextSample[p.name] =
        nextTypes[p.name] === 'categorical'
          ? p.uniqueValues[0] ?? ''
          : Math.round((p.median ?? p.mean ?? 0) * 10) / 10;
    });

    setDatasetId('datos_usuario');
    setDatasetLabel(`Archivo propio: ${uploadedFileName}`);
    setFileName(uploadedFileName);
    setRows(uploadedRows);
    setTargetCol(binaryTarget);
    setPositiveClass(posVal);
    setUserTypes(nextTypes);
    setSelectedPredictors(cols.filter((c) => c !== binaryTarget));
    setReferenceCategories(buildDefaultRefCategories(uploadedRows, nextTypes));
    setBusinessContext({
      pregunta: `¿El registro pertenecerá a la clase "${posVal}" en ${binaryTarget}?`,
      decision: 'Activar intervención preventiva o comercial sobre los casos de mayor probabilidad.',
      costoMayor: 'fn',
      descripcionCostos: 'Evaluar el impacto de dejar pasar un caso positivo frente al costo de una falsa alarma.',
      contextoIndustria: `Análisis predictivo sobre la base cargada (${uploadedFileName}).`,
    });
    setBalanceMethod('none');
    setThreshold(0.5);
    setSampleCase(nextSample);
    setSnapshots([]);
    setCaseMenuOpen(false);
  };

  const handleClearData = () => {
    setRows([]);
    setDatasetLabel('Sin base cargada');
    setTargetCol('');
    setPositiveClass('');
    setSelectedPredictors([]);
    setSnapshots([]);
    setCaseMenuOpen(false);
    setCurrentStep(2);
  };

  // Corregir anomalías en Paso 2 (imputa NA con mediana/moda y convierte negativos imposibles a valor absoluto)
  const handleFixAnomaliesImpute = () => {
    if (rows.length === 0) return;
    const currentProfiles = profileDataset(rows, userTypes);
    const profMap = new Map(currentProfiles.map((p) => [p.name, p]));
    const currentAnomalies = detectDataAnomalies(rows, currentProfiles);
    const anomalyMap = new Map<string, 'Faltante' | 'Valor imposible'>();
    currentAnomalies.forEach((a) => {
      anomalyMap.set(`${a.rowIndex}::${a.column}`, a.kind);
    });

    const cleaned = rows.map((row, idx) => {
      const copy = { ...row };
      Object.keys(copy).forEach((col) => {
        const kind = anomalyMap.get(`${idx}::${col}`);
        if (!kind) return;
        const prof = profMap.get(col);
        if (kind === 'Valor imposible') {
          const num = toNumericValue(copy[col]);
          if (num !== null && num < 0) {
            copy[col] = Math.abs(num);
          } else if (prof?.median !== undefined) {
            copy[col] = Math.round(prof.median * 10) / 10;
          }
        } else if (kind === 'Faltante') {
          if (prof?.inferredType === 'numeric' && prof.median !== undefined) {
            copy[col] = Math.round(prof.median * 10) / 10;
          } else if (prof && prof.uniqueValues.length > 0) {
            copy[col] = prof.uniqueValues[0];
          }
        }
      });
      return copy;
    });

    setRows(cleaned);
  };

  const handleDropAnomalyRows = () => {
    const currentProfiles = profileDataset(rows, userTypes);
    const currentAnomalies = detectDataAnomalies(rows, currentProfiles);
    const badRowIndices = new Set(currentAnomalies.map((a) => a.rowIndex));
    setRows((prev) => prev.filter((_, idx) => !badRowIndices.has(idx)));
  };

  // Perfilado, calidad y estadísticas descriptivas
  const profiles = useMemo(() => profileDataset(rows, userTypes), [rows, userTypes]);
  const anomalies = useMemo(() => detectDataAnomalies(rows, profiles), [rows, profiles]);
  const groupComparison = useMemo(
    () => computeGroupComparison(rows, profiles, targetCol, positiveClass),
    [rows, profiles, targetCol, positiveClass]
  );

  // Conteos de clases globales
  const classCounts = useMemo(() => {
    let c0 = 0;
    let c1 = 0;
    rows.forEach((r) => {
      const v = r[targetCol];
      if (isMissingValue(v)) return;
      if (String(v).trim() === positiveClass) c1++;
      else c0++;
    });
    return { count0: c0, count1: c1 };
  }, [rows, targetCol, positiveClass]);

  // Preparación de matriz de diseño (dummies n-1)
  const prepared = useMemo(
    () =>
      prepareDatasetForModel(
        rows,
        profiles,
        targetCol,
        positiveClass,
        selectedPredictors,
        referenceCategories
      ),
    [rows, profiles, targetCol, positiveClass, selectedPredictors, referenceCategories]
  );

  // División estratificada Train / Test con semilla
  const split = useMemo(() => {
    if (prepared.y.length < 4) {
      return {
        XTrain: [] as number[][],
        yTrain: [] as number[],
        XTest: [] as number[][],
        yTest: [] as number[],
        trainRowIndices: [] as number[],
        testRowIndices: [] as number[],
      };
    }
    const { trainIdx, testIdx } = stratifiedTrainTestSplit(prepared.y, trainRatio, seed);
    return {
      XTrain: trainIdx.map((i) => prepared.featureMatrix[i]),
      yTrain: trainIdx.map((i) => prepared.y[i]),
      XTest: testIdx.map((i) => prepared.featureMatrix[i]),
      yTest: testIdx.map((i) => prepared.y[i]),
      trainRowIndices: trainIdx.map((i) => prepared.rowIndices[i]),
      testRowIndices: testIdx.map((i) => prepared.rowIndices[i]),
    };
  }, [prepared, trainRatio, seed]);

  // Balanceo aplicado SOLO al entrenamiento
  const balancedTrain = useMemo(
    () =>
      applyTrainingBalance(
        split.XTrain,
        split.yTrain,
        prepared.features,
        balanceMethod,
        seed
      ),
    [split.XTrain, split.yTrain, prepared.features, balanceMethod, seed]
  );

  // Ajuste del modelo logístico por Máxima Verosimilitud (IRLS / Newton-Raphson)
  const model = useMemo(
    () =>
      fitLogisticRegressionIRLS(
        balancedTrain.X,
        balancedTrain.y,
        prepared.features,
        balancedTrain.weights
      ),
    [balancedTrain, prepared.features]
  );

  // Predicciones en Train (original sin balancear para evaluar honestamente) y Test
  const trainPreds = useMemo(
    () => predictProbabilities(split.XTrain, model.coefficients),
    [split.XTrain, model.coefficients]
  );
  const testPreds = useMemo(
    () => predictProbabilities(split.XTest, model.coefficients),
    [split.XTest, model.coefficients]
  );

  // Evaluaciones de matriz de confusión
  const trainEval = useMemo(
    () => evaluateConfusionMatrix(split.yTrain, trainPreds.probs, threshold),
    [split.yTrain, trainPreds.probs, threshold]
  );
  const testEval = useMemo(
    () => evaluateConfusionMatrix(split.yTest, testPreds.probs, threshold),
    [split.yTest, testPreds.probs, threshold]
  );

  // ROC & Lift en Prueba
  const rocResult = useMemo(
    () => computeRocCurve(split.yTest, testPreds.probs),
    [split.yTest, testPreds.probs]
  );
  const liftPoints = useMemo(
    () => computeLiftCurve(split.yTest, testPreds.probs),
    [split.yTest, testPreds.probs]
  );

  // Ganancia neta en Prueba
  const profitResult = useMemo(
    () => computeProfitCurve(split.yTest, testPreds.probs, profitConfig),
    [split.yTest, testPreds.probs, profitConfig]
  );

  // Puntuación de toda la cartera modelada para Pasos 15 y 16
  const scoredRows: ScoredExportRow[] = useMemo(() => {
    const trainSet = new Set(split.trainRowIndices);
    const allPreds = predictProbabilities(prepared.featureMatrix, model.coefficients);

    return prepared.rowIndices.map((origIdx, idx) => {
      const p = allPreds.probs[idx] ?? 0;
      const riskLevel: 'Bajo' | 'Medio' | 'Alto' =
        p >= riskPolicy.highMin ? 'Alto' : p >= riskPolicy.lowMax ? 'Medio' : 'Bajo';
      return {
        originalIndex: origIdx,
        row: rows[origIdx],
        partition: trainSet.has(origIdx) ? 'Entrenamiento' : 'Prueba',
        probability: p,
        predictedClass: p >= threshold ? 1 : 0,
        riskLevel,
      };
    });
  }, [prepared, split.trainRowIndices, model.coefficients, rows, riskPolicy, threshold]);

  const riskCounts = useMemo(() => {
    let low = 0;
    let medium = 0;
    let high = 0;
    scoredRows.forEach((r) => {
      if (r.riskLevel === 'Bajo') low++;
      else if (r.riskLevel === 'Medio') medium++;
      else high++;
    });
    return { low, medium, high };
  }, [scoredRows]);

  // Asegurar que exista al menos una versión base en Paso 13 al entrar por primera vez
  const effectiveSnapshots: ModelSnapshot[] = useMemo(() => {
    if (snapshots.length > 0) return snapshots;
    return [
      {
        id: 'base-auto',
        name: 'Modelo base actual (referencia)',
        createdAt: new Date().toLocaleTimeString('es-CO'),
        selectedPredictors: [...selectedPredictors],
        balanceMethod,
        trainRatio,
        seed,
        threshold,
        aic: model.aic,
        aucTest: rocResult.auc,
        trainEval,
        testEval,
        featureCount: prepared.features.length,
        coefficients: model.coefficients,
      },
    ];
  }, [
    snapshots,
    selectedPredictors,
    balanceMethod,
    trainRatio,
    seed,
    threshold,
    model.aic,
    model.coefficients,
    rocResult.auc,
    trainEval,
    testEval,
    prepared.features.length,
  ]);

  const handleSaveSnapshot = (name: string) => {
    const snap: ModelSnapshot = {
      id: `snap-${Date.now()}`,
      name,
      createdAt: new Date().toLocaleTimeString('es-CO'),
      selectedPredictors: [...selectedPredictors],
      balanceMethod,
      trainRatio,
      seed,
      threshold,
      aic: model.aic,
      aucTest: rocResult.auc,
      trainEval,
      testEval,
      featureCount: prepared.features.length,
      coefficients: model.coefficients,
    };
    setSnapshots((prev) => (prev.length === 0 ? [...effectiveSnapshots, snap] : [...prev, snap]));
  };

  const handleApplySnapshot = (snap: ModelSnapshot) => {
    setSelectedPredictors(snap.selectedPredictors);
    setBalanceMethod(snap.balanceMethod);
    setTrainRatio(snap.trainRatio);
    setSeed(snap.seed);
    setThreshold(snap.threshold);
  };

  const handleDeleteSnapshot = (id: string) => {
    setSnapshots((prev) => prev.filter((s) => s.id !== id));
  };

  const activeCategoricalCols = useMemo(
    () =>
      selectedPredictors.filter(
        (col) => col !== targetCol && (userTypes[col] ?? 'numeric') === 'categorical'
      ),
    [selectedPredictors, targetCol, userTypes]
  );

  // Contexto dinámico para Código R equivalente y Hallazgo clave
  const rContext: RCodeContext = useMemo(
    () => ({
      datasetName: datasetId,
      fileName,
      targetCol,
      positiveClass,
      categoricalCols: activeCategoricalCols,
      referenceCategories,
      selectedPredictors,
      seed,
      trainRatio,
      balanceMethod,
      threshold,
      sampleCase,
    }),
    [
      datasetId,
      fileName,
      targetCol,
      positiveClass,
      activeCategoricalCols,
      referenceCategories,
      selectedPredictors,
      seed,
      trainRatio,
      balanceMethod,
      threshold,
      sampleCase,
    ]
  );

  const currentGuide = STEP_GUIDES[currentStep - 1];
  const rCodeForCurrentStep = useMemo(
    () => generateRCodeForStep(currentStep, rContext),
    [currentStep, rContext]
  );

  const liftAt20 = liftPoints.find((l) => l.pctContacted === 20)?.lift;
  const keyFinding = useMemo(
    () =>
      generateKeyFinding({
        step: currentStep,
        context: businessContext,
        totalRows: rows.length,
        colCount: profiles.length,
        anomalies,
        targetCol,
        positiveClass,
        count0: classCounts.count0,
        count1: classCounts.count1,
        groupComparison,
        balanceMethod,
        categoricalCols: activeCategoricalCols,
        encodedFeatureCount: prepared.features.length,
        trainRatio,
        seed,
        trainCount: split.yTrain.length,
        trainOnes: balancedTrain.originalCount1,
        testCount: split.yTest.length,
        testOnes: split.yTest.filter((y) => y === 1).length,
        model,
        threshold,
        trainEval,
        testEval,
        aucTest: rocResult.auc,
        liftAt20,
        bestProfitPoint: profitResult.bestPoint,
        riskPolicy,
        riskCounts,
      }),
    [
      currentStep,
      businessContext,
      rows.length,
      profiles.length,
      anomalies,
      targetCol,
      positiveClass,
      classCounts,
      groupComparison,
      balanceMethod,
      activeCategoricalCols,
      prepared.features.length,
      trainRatio,
      seed,
      split.yTrain.length,
      split.yTest,
      balancedTrain.originalCount1,
      model,
      threshold,
      trainEval,
      testEval,
      rocResult.auc,
      liftAt20,
      profitResult.bestPoint,
      riskPolicy,
      riskCounts,
    ]
  );

  const handleDownloadHtml = () => {
    const html = buildHtmlReport({
      datasetLabel,
      totalRows: rows.length,
      modeledRows: prepared.y.length,
      targetCol,
      positiveClass,
      context: businessContext,
      model,
      trainEval,
      testEval,
      aucTest: rocResult.auc,
      threshold,
      profitConfig,
      bestProfitPoint: profitResult.bestPoint,
      riskPolicy,
      riskCounts,
      rContext,
    });
    triggerDownload(html, `informe_riesgo_${datasetId}.html`, 'text/html');
  };

  const handleDownloadCsv = () => {
    const csv = buildScoredCsv(scoredRows);
    triggerDownload(csv, `predicciones_riesgo_${datasetId}.csv`, 'text/csv');
  };

  const handleTopFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { rows: parsed } = await parseUploadedDataset(file);
    if (parsed.length > 0) {
      handleUploadRows(parsed, file.name);
      setCurrentStep(2);
    }
    e.target.value = '';
  };

  const progressPct = Math.round((currentStep / 16) * 100);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zonas (Marca · 5 links CRISP-DM · 1 CTA primario) */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-8 px-4 sm:px-6 py-3">
          {/* Zona 1: Marca en una sola línea */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Abrir menú de pasos"
              className="lg:hidden rounded-lg border border-slate-200 p-2 text-slate-700 hover:bg-slate-50"
            >
              {mobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0 text-left"
            >
              Predictor de Riesgo
            </button>
          </div>

          {/* Zona 2: 5 enlaces concisos de fases CRISP-DM */}
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            {[
              { label: 'Negocio', step: 1, activeRange: [1, 1] },
              { label: 'Datos', step: 2, activeRange: [2, 7] },
              { label: 'Modelado', step: 8, activeRange: [8, 9] },
              { label: 'Evaluación', step: 10, activeRange: [10, 13] },
              { label: 'Despliegue', step: 14, activeRange: [14, 16] },
            ].map((item) => {
              const isActive =
                currentStep >= item.activeRange[0] && currentStep <= item.activeRange[1];
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setCurrentStep(item.step)}
                  className={`whitespace-nowrap shrink-0 pb-0.5 transition-colors ${
                    isActive
                      ? 'text-blue-700 font-semibold border-b-2 border-blue-700'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </nav>

          {/* Zona 3: 1 Acción primaria */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCaseMenuOpen((o) => !o)}
              aria-expanded={caseMenuOpen}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <span>Cargar caso ejemplo</span>
              <ChevronDown className="h-3.5 w-3.5" aria-hidden="true" />
            </button>

            {caseMenuOpen && (
              <div
                className="absolute right-0 mt-2 w-80 rounded-xl border border-slate-200 bg-white p-2 shadow-lg z-40"
                role="menu"
              >
                <button
                  type="button"
                  onClick={() => handleLoadEmbedded('cartera')}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Taller – Cartera IPS (852 clientes)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Base principal · Objetivo: retrasos (1)
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleLoadEmbedded('satisfaccion')}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-xs hover:bg-slate-50"
                >
                  <FileSpreadsheet className="h-4 w-4 text-blue-700 shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-slate-900">
                      Taller – Satisfacción bancaria (12 clientes)
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Edad, saldo · Objetivo: satisfecho (1)
                    </div>
                  </div>
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => {
                    setCaseMenuOpen(false);
                    topFileInputRef.current?.click();
                  }}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-slate-800 hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4 text-slate-600 shrink-0" />
                  <span>Subir archivo propio (.csv / .xlsx)</span>
                </button>
                {rows.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearData}
                    className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-xs font-semibold text-rose-700 hover:bg-rose-50"
                  >
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span>Borrar base actual</span>
                  </button>
                )}
              </div>
            )}
            <input
              ref={topFileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleTopFileUpload}
              className="hidden"
            />
          </div>
        </div>
      </header>

      {/* Workspace principal: Sidebar CRISP-DM + Viewport del paso */}
      <div className="mx-auto flex w-full max-w-[1440px] flex-1">
        {/* Sidebar de 16 pasos */}
        <aside
          className={`${
            mobileMenuOpen ? 'fixed inset-y-0 left-0 z-40 block w-72 bg-white shadow-xl pt-4' : 'hidden'
          } lg:block lg:w-72 lg:shrink-0 border-r border-slate-200 bg-white`}
        >
          <div className="p-4 border-b border-slate-200">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Progreso CRISP-DM</span>
              <span className="font-mono tabular-nums text-blue-800">{progressPct}%</span>
            </div>
            <div className="mt-2 h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-700 transition-all duration-200"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="mt-2 text-[11px] text-slate-500 truncate">
              Base: <span className="font-medium text-slate-700">{datasetLabel}</span>
            </div>
          </div>

          <nav aria-label="Pasos del asistente CRISP-DM" className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-140px)]">
            {STEP_GUIDES.map((g, index) => {
              const isCurrent = g.stepNumber === currentStep;
              const prevPhase = index > 0 ? STEP_GUIDES[index - 1].phase : '';
              const showPhaseHeading = g.phase !== prevPhase;
              const disabledStep = rows.length === 0 && g.stepNumber > 2;

              return (
                <React.Fragment key={g.stepNumber}>
                  {showPhaseHeading && (
                    <div className="px-2.5 pt-3 pb-1 text-[11px] font-bold text-slate-400">
                      {g.phase}
                    </div>
                  )}
                  <button
                    type="button"
                    disabled={disabledStep}
                    onClick={() => {
                      setCurrentStep(g.stepNumber);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                      isCurrent
                        ? 'bg-blue-50 text-blue-900 font-semibold'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed'
                    }`}
                  >
                    <span
                      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded font-mono text-[11px] tabular-nums ${
                        isCurrent
                          ? 'bg-blue-700 text-white font-bold'
                          : g.stepNumber < currentStep
                            ? 'bg-emerald-100 text-emerald-800 font-semibold'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {g.stepNumber}
                    </span>
                    <span className="truncate">{g.title}</span>
                  </button>
                </React.Fragment>
              );
            })}
          </nav>
        </aside>

        {/* Contenido principal del paso activo */}
        <main className="flex-1 min-w-0 px-4 py-6 sm:px-8 sm:py-8">
          <div className="mx-auto max-w-5xl">
            <StepHeader guide={currentGuide} />

            <KeyFindingBox finding={keyFinding.text} tone={keyFinding.tone} />

            {rows.length === 0 && currentStep > 2 ? (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                <p className="text-sm font-semibold text-slate-800">
                  Carga una base de datos en el Paso 2 para continuar con el análisis.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="mt-4 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800"
                >
                  Ir al Paso 2 – Cargar datos
                </button>
              </div>
            ) : (
              <>
                {currentStep === 1 && (
                  <Step1Business context={businessContext} onChange={setBusinessContext} />
                )}
                {currentStep === 2 && (
                  <Step2DataQuality
                    datasetLabel={datasetLabel}
                    rows={rows}
                    profiles={profiles}
                    anomalies={anomalies}
                    onLoadEmbedded={handleLoadEmbedded}
                    onUploadRows={handleUploadRows}
                    onClearData={handleClearData}
                    onFixAnomaliesImpute={handleFixAnomaliesImpute}
                    onDropAnomalyRows={handleDropAnomalyRows}
                  />
                )}
                {currentStep === 3 && (
                  <Step3Target
                    rows={rows}
                    profiles={profiles}
                    targetCol={targetCol}
                    positiveClass={positiveClass}
                    onChangeTarget={(nextTarget) => {
                      setTargetCol(nextTarget);
                      const prof = profiles.find((p) => p.name === nextTarget);
                      const nextPos = prof?.uniqueValues.includes('1')
                        ? '1'
                        : prof?.uniqueValues[prof.uniqueValues.length - 1] ?? '1';
                      setPositiveClass(nextPos);
                      setSelectedPredictors(
                        profiles.map((p) => p.name).filter((n) => n !== nextTarget)
                      );
                    }}
                    onChangePositiveClass={setPositiveClass}
                  />
                )}
                {currentStep === 4 && (
                  <Step4Descriptive
                    rows={rows}
                    profiles={profiles}
                    targetCol={targetCol}
                    positiveClass={positiveClass}
                    groupComparison={groupComparison}
                  />
                )}
                {currentStep === 5 && (
                  <Step5ClassBalance
                    count0={classCounts.count0}
                    count1={classCounts.count1}
                    positiveClass={positiveClass}
                    targetCol={targetCol}
                    balanceMethod={balanceMethod}
                    onChangeBalance={setBalanceMethod}
                    trainOriginal0={balancedTrain.originalCount0}
                    trainOriginal1={balancedTrain.originalCount1}
                    trainBalanced0={balancedTrain.finalCount0}
                    trainBalanced1={balancedTrain.finalCount1}
                  />
                )}
                {currentStep === 6 && (
                  <Step6Preparation
                    profiles={profiles}
                    targetCol={targetCol}
                    selectedPredictors={selectedPredictors}
                    userTypes={userTypes}
                    referenceCategories={referenceCategories}
                    encodedFeatures={prepared.features}
                    onTogglePredictor={(col) =>
                      setSelectedPredictors((prev) =>
                        prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
                      )
                    }
                    onChangeVariableType={(col, nextType) =>
                      setUserTypes((prev) => ({ ...prev, [col]: nextType }))
                    }
                    onChangeReferenceCategory={(col, refVal) =>
                      setReferenceCategories((prev) => ({ ...prev, [col]: refVal }))
                    }
                  />
                )}
                {currentStep === 7 && (
                  <Step7Split
                    trainRatio={trainRatio}
                    seed={seed}
                    onChangeTrainRatio={setTrainRatio}
                    onChangeSeed={setSeed}
                    trainCount={split.yTrain.length}
                    trainOnes={balancedTrain.originalCount1}
                    testCount={split.yTest.length}
                    testOnes={split.yTest.filter((y) => y === 1).length}
                    balancedTrainCount={balancedTrain.y.length}
                    balancedTrainOnes={balancedTrain.finalCount1}
                    balanceMethod={balanceMethod}
                    droppedRowCount={prepared.droppedRowCount}
                  />
                )}
                {currentStep === 8 && (
                  <Step8Model model={model} targetOutcomeName={targetCol} />
                )}
                {currentStep === 9 && (
                  <Step9SCurve
                    zTest={testPreds.zValues}
                    yTest={split.yTest}
                    pTest={testPreds.probs}
                    threshold={threshold}
                    onChangeThreshold={setThreshold}
                    testEval={testEval}
                  />
                )}
                {currentStep === 10 && (
                  <Step10ConfusionMatrix
                    trainEval={trainEval}
                    testEval={testEval}
                    threshold={threshold}
                    onChangeThreshold={setThreshold}
                    positiveClass={positiveClass}
                  />
                )}
                {currentStep === 11 && (
                  <Step11RocLift
                    rocPoints={rocResult.points}
                    aucTest={rocResult.auc}
                    liftPoints={liftPoints}
                  />
                )}
                {currentStep === 12 && (
                  <Step12Profit
                    profitConfig={profitConfig}
                    onChangeProfitConfig={setProfitConfig}
                    profitCurve={profitResult.points}
                    bestPoint={profitResult.bestPoint}
                    currentThreshold={threshold}
                    onApplyOptimalThreshold={(t) => setThreshold(t)}
                  />
                )}
                {currentStep === 13 && (
                  <Step13CompareModels
                    snapshots={effectiveSnapshots}
                    currentSummary={{
                      selectedPredictors,
                      balanceMethod,
                      threshold,
                      accuracyTest: testEval.accuracy,
                      f1Test: testEval.class1.f1,
                      aucTest: rocResult.auc,
                      aic: model.aic,
                    }}
                    onSaveSnapshot={handleSaveSnapshot}
                    onApplySnapshot={handleApplySnapshot}
                    onDeleteSnapshot={handleDeleteSnapshot}
                  />
                )}
                {currentStep === 14 && (
                  <Step14IndividualPrediction
                    profiles={profiles}
                    selectedPredictors={selectedPredictors}
                    userTypes={userTypes}
                    encodedFeatures={prepared.features}
                    model={model}
                    threshold={threshold}
                    positiveClass={positiveClass}
                    sampleCase={sampleCase}
                    onChangeSampleCase={setSampleCase}
                    riskPolicy={riskPolicy}
                  />
                )}
                {currentStep === 15 && (
                  <Step15BusinessActions
                    scoredRows={scoredRows}
                    riskPolicy={riskPolicy}
                    onChangeRiskPolicy={setRiskPolicy}
                    targetCol={targetCol}
                  />
                )}
                {currentStep === 16 && (
                  <Step16Export
                    scoredRows={scoredRows}
                    onDownloadHtml={handleDownloadHtml}
                    onDownloadCsv={handleDownloadCsv}
                  />
                )}
              </>
            )}

            <RCodeCollapsible code={rCodeForCurrentStep} />

            <StepFooterNav
              currentStep={currentStep}
              totalSteps={16}
              onPrev={() => setCurrentStep((s) => Math.max(1, s - 1))}
              onNext={() => setCurrentStep((s) => Math.min(16, s + 1))}
              canNext={!(rows.length === 0 && currentStep >= 2)}
            />
          </div>
        </main>
      </div>
    </div>
  );
}
