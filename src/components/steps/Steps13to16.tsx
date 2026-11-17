import React from 'react';
import {
  Award,
  BookmarkPlus,
  Download,
  FileCode2,
  FileSpreadsheet,
  ShieldAlert,
  Trash2,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  BalanceMethod,
  ColumnProfile,
  EncodedFeatureInfo,
  LogisticModelResult,
  ModelSnapshot,
  RawRow,
  RiskPolicy,
  VariableRoleType,
} from '../../types/model';
import { sigmoid } from '../../utils/logisticRegression';
import {
  formatFlexibleCO,
  formatIntCO,
  formatNumberCO,
  formatPercentCO,
} from '../../utils/formatters';
import { ScoredExportRow } from '../../utils/exporters';

/* ============================================================================
   PASO 13: COMPARAR MODELOS
   ============================================================================ */
interface Step13Props {
  snapshots: ModelSnapshot[];
  currentSummary: {
    selectedPredictors: string[];
    balanceMethod: BalanceMethod;
    threshold: number;
    accuracyTest: number;
    f1Test: number;
    aucTest: number;
    aic: number;
  };
  onSaveSnapshot: (name: string) => void;
  onApplySnapshot: (snap: ModelSnapshot) => void;
  onDeleteSnapshot: (id: string) => void;
}

const BALANCE_LABELS: Record<BalanceMethod, string> = {
  none: 'Ninguno',
  undersample: 'Submuestreo',
  oversample: 'Sobremuestreo',
  smote: 'SMOTE',
  weights: 'Pesos por clase',
};

export const Step13CompareModels: React.FC<Step13Props> = ({
  snapshots,
  currentSummary,
  onSaveSnapshot,
  onApplySnapshot,
  onDeleteSnapshot,
}) => {
  const [customName, setCustomName] = React.useState('');

  // Encontrar mejor modelo por F1 de la clase de interés en prueba (desempate por AUC y menor AIC)
  const bestSnapshotId = React.useMemo(() => {
    if (snapshots.length === 0) return null;
    const sorted = [...snapshots].sort((a, b) => {
      const f1Diff = b.testEval.class1.f1 - a.testEval.class1.f1;
      if (Math.abs(f1Diff) > 0.002) return f1Diff;
      const aucDiff = b.aucTest - a.aucTest;
      if (Math.abs(aucDiff) > 0.002) return aucDiff;
      return a.aic - b.aic;
    });
    return sorted[0].id;
  }, [snapshots]);

  const handleSave = () => {
    const label =
      customName.trim() ||
      `Versión ${snapshots.length + 1} (${BALANCE_LABELS[currentSummary.balanceMethod]}, corte ${formatNumberCO(currentSummary.threshold, 2)})`;
    onSaveSnapshot(label);
    setCustomName('');
  };

  return (
    <div className="space-y-6">
      {/* Barra para guardar versión actual */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[240px]">
            <label htmlFor="model-version-name" className="block text-sm font-bold text-slate-900">
              Guardar configuración actual como versión para comparar
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Configuración en vivo: {currentSummary.selectedPredictors.length} variables ·{' '}
              {BALANCE_LABELS[currentSummary.balanceMethod]} · Corte{' '}
              {formatNumberCO(currentSummary.threshold, 2)} · F1 Prueba ={' '}
              <strong className="font-mono text-blue-800">
                {formatPercentCO(currentSummary.f1Test, 1)}
              </strong>{' '}
              · AUC ={' '}
              <strong className="font-mono text-slate-900">
                {formatNumberCO(currentSummary.aucTest, 3)}
              </strong>
            </p>
            <input
              id="model-version-name"
              type="text"
              placeholder="Ej: Solo significativas + SMOTE + corte 0,38"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              className="mt-2.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <BookmarkPlus className="h-4 w-4" aria-hidden="true" />
            <span>Guardar versión actual</span>
          </button>
        </div>
      </div>

      {/* Tabla comparativa */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-base font-bold text-slate-900">
            Tabla comparativa de modelos (métricas sobre Prueba)
          </h2>
          <span className="text-xs text-slate-500">
            Objetivo principal: subir el F1 de la clase de interés sin perder generalización
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Versión</th>
                <th className="px-3 py-2.5 text-left font-semibold">Variables / Balanceo</th>
                <th className="px-3 py-2.5 text-right font-semibold">Corte</th>
                <th className="px-3 py-2.5 text-right font-semibold">Accuracy</th>
                <th className="px-3 py-2.5 text-right font-semibold">F1 Clase 1</th>
                <th className="px-3 py-2.5 text-right font-semibold">AUC</th>
                <th className="px-3 py-2.5 text-right font-semibold">AIC</th>
                <th className="px-3 py-2.5 text-right font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {snapshots.map((snap) => {
                const isBest = snap.id === bestSnapshotId;
                return (
                  <tr
                    key={snap.id}
                    className={isBest ? 'bg-emerald-50/50' : 'hover:bg-slate-50/70'}
                  >
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5 font-semibold text-slate-900">
                        {isBest && (
                          <Award className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                        )}
                        <span>{snap.name}</span>
                      </div>
                      {isBest && (
                        <div className="text-[11px] font-semibold text-emerald-800 mt-0.5">
                          Recomendado (mejor equilibrio F1 / AUC)
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-slate-600">
                      <div>{snap.selectedPredictors.length} variables · {BALANCE_LABELS[snap.balanceMethod]}</div>
                      <div className="text-[11px] text-slate-400 truncate max-w-[220px]">
                        {snap.selectedPredictors.join(', ')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                      {formatNumberCO(snap.threshold, 2)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                      {formatPercentCO(snap.testEval.accuracy, 1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-bold text-blue-900">
                      {formatPercentCO(snap.testEval.class1.f1, 1)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatNumberCO(snap.aucTest, 3)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {formatNumberCO(snap.aic, 1)}
                    </td>
                    <td className="px-3 py-2.5 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onApplySnapshot(snap)}
                        className="text-xs font-semibold text-blue-700 hover:underline mr-3"
                      >
                        Cargar
                      </button>
                      {snapshots.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onDeleteSnapshot(snap.id)}
                          aria-label={`Eliminar ${snap.name}`}
                          className="text-slate-400 hover:text-rose-700"
                        >
                          <Trash2 className="h-3.5 w-3.5 inline" aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 14: PREDICCIÓN INDIVIDUAL PASO A PASO
   ============================================================================ */
interface Step14Props {
  profiles: ColumnProfile[];
  selectedPredictors: string[];
  userTypes: Record<string, VariableRoleType>;
  encodedFeatures: EncodedFeatureInfo[];
  model: LogisticModelResult;
  threshold: number;
  positiveClass: string;
  sampleCase: Record<string, string | number>;
  onChangeSampleCase: (next: Record<string, string | number>) => void;
  riskPolicy: RiskPolicy;
}

export const Step14IndividualPrediction: React.FC<Step14Props> = ({
  profiles,
  selectedPredictors,
  userTypes,
  encodedFeatures,
  model,
  threshold,
  positiveClass,
  sampleCase,
  onChangeSampleCase,
  riskPolicy,
}) => {
  const activePredictors = profiles.filter((p) => selectedPredictors.includes(p.name));

  // Construir desglose paso a paso del cálculo de z
  const intercept = model.coefficients[0]?.estimate ?? 0;
  const breakdown = encodedFeatures.map((feat, idx) => {
    const coef = model.coefficients[idx + 1]?.estimate ?? 0;
    const rawVal = sampleCase[feat.sourceColumn];
    const xVal = feat.isDummy
      ? String(rawVal ?? '').trim() === feat.categoryValue
        ? 1
        : 0
      : Number(rawVal ?? 0) || 0;
    const contrib = xVal * coef;
    return {
      name: feat.featureName,
      xVal,
      coef,
      contrib,
    };
  });

  const zTotal = intercept + breakdown.reduce((acc, row) => acc + row.contrib, 0);
  const prob = sigmoid(zTotal);
  const predictedOne = prob >= threshold;
  const riskTier =
    prob >= riskPolicy.highMin ? 'Alto' : prob >= riskPolicy.lowMax ? 'Medio' : 'Bajo';

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Formulario del nuevo caso */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Ingresa los datos de un cliente o caso nuevo
          </h2>
          <p className="text-xs text-slate-500">
            Modifica cualquier valor para observar inmediatamente cómo cambia el puntaje z y la probabilidad final.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {activePredictors.map((prof) => {
              const role = userTypes[prof.name] ?? prof.userType;
              const currentVal =
                sampleCase[prof.name] ??
                (role === 'categorical'
                  ? prof.uniqueValues[0] ?? ''
                  : Math.round((prof.median ?? prof.mean ?? 0) * 10) / 10);

              return (
                <div key={prof.name}>
                  <label
                    htmlFor={`case-${prof.name}`}
                    className="block text-xs font-semibold text-slate-800 mb-1"
                  >
                    {prof.name}
                  </label>
                  {role === 'categorical' ? (
                    <select
                      id={`case-${prof.name}`}
                      value={String(currentVal)}
                      onChange={(e) =>
                        onChangeSampleCase({ ...sampleCase, [prof.name]: e.target.value })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
                    >
                      {prof.uniqueValues.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      id={`case-${prof.name}`}
                      type="number"
                      step="any"
                      value={currentVal}
                      onChange={(e) =>
                        onChangeSampleCase({
                          ...sampleCase,
                          [prof.name]: e.target.value === '' ? 0 : Number(e.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Desglose matemático paso a paso */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Cálculo paso a paso (z → probabilidad → decisión)
          </h2>

          <div className="overflow-x-auto max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Término</th>
                  <th className="px-3 py-2 text-right font-semibold">Valor X</th>
                  <th className="px-3 py-2 text-right font-semibold">Coef. b</th>
                  <th className="px-3 py-2 text-right font-semibold">X · b</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                <tr className="bg-slate-50/40">
                  <td className="px-3 py-1.5 font-semibold text-slate-800">(Intercept)</td>
                  <td className="px-3 py-1.5 text-right text-slate-500">1</td>
                  <td className="px-3 py-1.5 text-right text-slate-700">
                    {formatFlexibleCO(intercept, 4)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold text-slate-900">
                    {formatFlexibleCO(intercept, 4)}
                  </td>
                </tr>
                {breakdown.map((row) => (
                  <tr key={row.name}>
                    <td className="px-3 py-1.5 text-slate-800">{row.name}</td>
                    <td className="px-3 py-1.5 text-right text-slate-700">
                      {formatFlexibleCO(row.xVal, 2)}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-600">
                      {formatFlexibleCO(row.coef, 4)}
                    </td>
                    <td className="px-3 py-1.5 text-right font-semibold text-slate-900">
                      {row.contrib >= 0 ? '+' : ''}
                      {formatFlexibleCO(row.contrib, 4)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Resultado de z y p */}
          <div className="grid gap-3 sm:grid-cols-3 pt-1">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-[11px] text-slate-500">1. Suma lineal z</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-slate-900 tabular-nums">
                {formatNumberCO(zTotal, 3)}
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
              <div className="text-[11px] text-blue-800">2. Probabilidad 1/(1+e^-z)</div>
              <div className="mt-0.5 font-mono text-lg font-bold text-blue-900 tabular-nums">
                {formatPercentCO(prob, 1)}
              </div>
            </div>
            <div
              className={`rounded-lg border p-3 ${
                predictedOne
                  ? 'border-rose-200 bg-rose-50/70'
                  : 'border-emerald-200 bg-emerald-50/70'
              }`}
            >
              <div className="text-[11px] text-slate-600">
                3. Clase final (corte {formatNumberCO(threshold, 2)})
              </div>
              <div
                className={`mt-0.5 text-base font-bold ${
                  predictedOne ? 'text-rose-800' : 'text-emerald-800'
                }`}
              >
                {predictedOne ? `1 – Sí (${positiveClass})` : '0 – No'} · Riesgo {riskTier}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 15: ACCIONES DE NEGOCIO POR NIVEL DE RIESGO
   ============================================================================ */
interface Step15Props {
  scoredRows: ScoredExportRow[];
  riskPolicy: RiskPolicy;
  onChangeRiskPolicy: (next: RiskPolicy) => void;
  targetCol: string;
}

export const Step15BusinessActions: React.FC<Step15Props> = ({
  scoredRows,
  riskPolicy,
  onChangeRiskPolicy,
}) => {
  const lowCount = scoredRows.filter((r) => r.riskLevel === 'Bajo').length;
  const medCount = scoredRows.filter((r) => r.riskLevel === 'Medio').length;
  const highCount = scoredRows.filter((r) => r.riskLevel === 'Alto').length;
  const total = scoredRows.length;

  const chartData = [
    { nivel: 'Riesgo Bajo', cantidad: lowCount, color: '#15803D' },
    { nivel: 'Riesgo Medio', cantidad: medCount, color: '#D97706' },
    { nivel: 'Riesgo Alto', cantidad: highCount, color: '#DC2626' },
  ];

  const topHighRisk = [...scoredRows]
    .filter((r) => r.riskLevel === 'Alto')
    .sort((a, b) => b.probability - a.probability)
    .slice(0, 12);

  const sampleKeys =
    scoredRows.length > 0 ? Object.keys(scoredRows[0].row).slice(0, 5) : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Umbrales y acciones por nivel */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              Reglas de segmentación y plan de acción comercial
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 border-b border-slate-200 pb-4">
            <div>
              <label htmlFor="low-max" className="block text-xs font-semibold text-slate-800">
                Límite superior Riesgo Bajo (probabilidad &lt;)
              </label>
              <input
                id="low-max"
                type="number"
                min={0.05}
                max={0.8}
                step={0.05}
                value={riskPolicy.lowMax}
                onChange={(e) => {
                  const v = Math.min(riskPolicy.highMin - 0.05, Math.max(0.05, Number(e.target.value) || 0.3));
                  onChangeRiskPolicy({ ...riskPolicy, lowMax: v });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label htmlFor="high-min" className="block text-xs font-semibold text-slate-800">
                Límite inferior Riesgo Alto (probabilidad ≥)
              </label>
              <input
                id="high-min"
                type="number"
                min={0.1}
                max={0.95}
                step={0.05}
                value={riskPolicy.highMin}
                onChange={(e) => {
                  const v = Math.max(riskPolicy.lowMax + 0.05, Math.min(0.95, Number(e.target.value) || 0.6));
                  onChangeRiskPolicy({ ...riskPolicy, highMin: v });
                }}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 font-mono text-sm tabular-nums"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 p-3">
              <div className="flex justify-between text-xs font-bold text-emerald-900 mb-1">
                <span>Riesgo Bajo (&lt; {formatPercentCO(riskPolicy.lowMax, 0)})</span>
                <span className="font-mono tabular-nums">
                  {formatIntCO(lowCount)} casos ({formatPercentCO(total ? lowCount / total : 0, 1)})
                </span>
              </div>
              <input
                type="text"
                aria-label="Acción para riesgo bajo"
                value={riskPolicy.actionLow}
                onChange={(e) => onChangeRiskPolicy({ ...riskPolicy, actionLow: e.target.value })}
                className="w-full rounded border border-emerald-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-3">
              <div className="flex justify-between text-xs font-bold text-amber-900 mb-1">
                <span>
                  Riesgo Medio ({formatPercentCO(riskPolicy.lowMax, 0)} –{' '}
                  {formatPercentCO(riskPolicy.highMin, 0)})
                </span>
                <span className="font-mono tabular-nums">
                  {formatIntCO(medCount)} casos ({formatPercentCO(total ? medCount / total : 0, 1)})
                </span>
              </div>
              <input
                type="text"
                aria-label="Acción para riesgo medio"
                value={riskPolicy.actionMedium}
                onChange={(e) => onChangeRiskPolicy({ ...riskPolicy, actionMedium: e.target.value })}
                className="w-full rounded border border-amber-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>

            <div className="rounded-lg border border-rose-200 bg-rose-50/40 p-3">
              <div className="flex justify-between text-xs font-bold text-rose-900 mb-1">
                <span>Riesgo Alto (≥ {formatPercentCO(riskPolicy.highMin, 0)})</span>
                <span className="font-mono tabular-nums">
                  {formatIntCO(highCount)} casos ({formatPercentCO(total ? highCount / total : 0, 1)})
                </span>
              </div>
              <input
                type="text"
                aria-label="Acción para riesgo alto"
                value={riskPolicy.actionHigh}
                onChange={(e) => onChangeRiskPolicy({ ...riskPolicy, actionHigh: e.target.value })}
                className="w-full rounded border border-rose-200 bg-white px-2.5 py-1.5 text-xs text-slate-800"
              />
            </div>
          </div>
        </div>

        {/* Gráfico de distribución */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h3 className="text-base font-bold text-slate-900 mb-1">Distribución de la cartera</h3>
          <p className="text-xs text-slate-500 mb-4">
            Cantidad de registros clasificados por nivel de riesgo
          </p>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="nivel" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v: unknown) => [formatIntCO(Number(v)), 'Casos']} />
                <Bar dataKey="cantidad" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lista prioritaria de Riesgo Alto */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">
            Casos prioritarios en Riesgo Alto (Top {topHighRisk.length} de {formatIntCO(highCount)})
          </h3>
          <span className="text-xs text-slate-500">Ordenados de mayor a menor probabilidad</span>
        </div>

        {topHighRisk.length === 0 ? (
          <p className="text-xs text-slate-500">
            Ningún caso supera actualmente el umbral de Riesgo Alto ({formatPercentCO(riskPolicy.highMin, 0)}).
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left font-semibold">Fila</th>
                  <th className="px-3 py-2 text-left font-semibold">Partición</th>
                  {sampleKeys.map((k) => (
                    <th key={k} className="px-3 py-2 text-right font-semibold">
                      {k}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-semibold">Probabilidad</th>
                  <th className="px-3 py-2 text-left font-semibold">Acción recomendada</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {topHighRisk.map((item) => (
                  <tr key={item.originalIndex} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-mono text-slate-500">
                      #{item.originalIndex + 1}
                    </td>
                    <td className="px-3 py-2 text-slate-700">{item.partition}</td>
                    {sampleKeys.map((k) => (
                      <td key={k} className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                        {String(item.row[k] ?? '—')}
                      </td>
                    ))}
                    <td className="px-3 py-2 text-right font-mono font-bold text-rose-700 tabular-nums">
                      {formatPercentCO(item.probability, 1)}
                    </td>
                    <td className="px-3 py-2 text-slate-700 max-w-xs truncate">
                      {riskPolicy.actionHigh}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 16: EXPORTAR INFORME HTML Y CSV DE PREDICCIONES
   ============================================================================ */
interface Step16Props {
  scoredRows: ScoredExportRow[];
  onDownloadHtml: () => void;
  onDownloadCsv: () => void;
}

export const Step16Export: React.FC<Step16Props> = ({
  scoredRows,
  onDownloadHtml,
  onDownloadCsv,
}) => {
  const preview = scoredRows.slice(0, 8);
  const cols = scoredRows.length > 0 ? Object.keys(scoredRows[0].row).slice(0, 4) : [];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-blue-700 mb-2">
              <FileCode2 className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                Informe ejecutivo completo (.html)
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Genera un documento autónomo listo para abrir en cualquier navegador o imprimir en PDF. Incluye la pregunta de negocio, métricas de Prueba, tabla de coeficientes con Odds Ratios, matrices de confusión, ganancia neta óptima, segmentos de riesgo y el script completo de código R equivalente.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadHtml}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Descargar informe HTML</span>
          </button>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-emerald-700 mb-2">
              <FileSpreadsheet className="h-5 w-5" aria-hidden="true" />
              <h2 className="text-base font-bold text-slate-900">
                Base puntuada con riesgo y probabilidad (.csv)
              </h2>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Descarga los {formatIntCO(scoredRows.length)} registros procesados junto con su partición (Entrenamiento/Prueba), la probabilidad calculada, la clase predicha (0/1) según tu punto de corte y el nivel de riesgo asignado (Bajo, Medio o Alto) para abrir directamente en Excel.
            </p>
          </div>
          <button
            type="button"
            onClick={onDownloadCsv}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-700 bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 whitespace-nowrap"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            <span>Descargar predicciones CSV</span>
          </button>
        </div>
      </div>

      {/* Vista previa del CSV exportable */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          Vista previa del archivo CSV exportable (primeras {preview.length} filas)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold">Fila</th>
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 text-right font-semibold">
                    {c}
                  </th>
                ))}
                <th className="px-3 py-2 text-left font-semibold">Partición</th>
                <th className="px-3 py-2 text-right font-semibold">Probabilidad</th>
                <th className="px-3 py-2 text-right font-semibold">Clase predicha</th>
                <th className="px-3 py-2 text-left font-semibold">Nivel riesgo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
              {preview.map((item) => (
                <tr key={item.originalIndex} className="hover:bg-slate-50/70">
                  <td className="px-3 py-2 text-slate-500">#{item.originalIndex + 1}</td>
                  {cols.map((c) => (
                    <td key={c} className="px-3 py-2 text-right text-slate-700">
                      {String(item.row[c] ?? '—')}
                    </td>
                  ))}
                  <td className="px-3 py-2 font-sans text-slate-700">{item.partition}</td>
                  <td className="px-3 py-2 text-right font-semibold text-blue-900">
                    {formatPercentCO(item.probability, 1)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-slate-900">
                    {item.predictedClass}
                  </td>
                  <td
                    className={`px-3 py-2 font-sans font-semibold ${
                      item.riskLevel === 'Alto'
                        ? 'text-rose-700'
                        : item.riskLevel === 'Medio'
                          ? 'text-amber-700'
                          : 'text-emerald-700'
                    }`}
                  >
                    {item.riskLevel}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
