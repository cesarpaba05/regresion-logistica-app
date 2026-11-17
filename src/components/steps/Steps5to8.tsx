import React from 'react';
import { AlertCircle, CheckCircle2, Info, Layers, RefreshCw } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
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
  VariableRoleType,
} from '../../types/model';
import { interpretCoefficientPlainSpanish } from '../../utils/evaluation';
import {
  formatFlexibleCO,
  formatIntCO,
  formatNumberCO,
  formatPercentCO,
  formatPValueCO,
} from '../../utils/formatters';

/* ============================================================================
   PASO 5: BALANCE DE CLASES
   ============================================================================ */
interface Step5Props {
  count0: number;
  count1: number;
  positiveClass: string;
  targetCol: string;
  balanceMethod: BalanceMethod;
  onChangeBalance: (method: BalanceMethod) => void;
  trainOriginal0: number;
  trainOriginal1: number;
  trainBalanced0: number;
  trainBalanced1: number;
}

const BALANCE_OPTIONS: Array<{ id: BalanceMethod; name: string; desc: string }> = [
  {
    id: 'none',
    name: 'Ninguno (datos originales)',
    desc: 'Mantiene las proporciones reales. Ideal cuando las clases no están extremadamente desbalanceadas o cuando luego ajustaremos el punto de corte.',
  },
  {
    id: 'undersample',
    name: 'Submuestreo (reducir clase mayoritaria)',
    desc: 'Toma al azar una muestra de la clase mayoritaria igual al tamaño de la minoritaria en entrenamiento. Rápido, aunque descarta registros mayoritarios.',
  },
  {
    id: 'oversample',
    name: 'Sobremuestreo (replicar clase minoritaria)',
    desc: 'Duplica aleatoriamente casos de la clase minoritaria en entrenamiento hasta igualar la mayoritaria. Conserva todos los datos.',
  },
  {
    id: 'smote',
    name: 'Datos sintéticos tipo SMOTE',
    desc: 'Crea nuevos ejemplos sintéticos interpolando vecinos cercanos de la clase minoritaria en entrenamiento. Evita copias idénticas.',
  },
  {
    id: 'weights',
    name: 'Pesos por clase (ponderación en el modelo)',
    desc: 'Asigna mayor peso en la función de verosimilitud a los errores sobre la clase minoritaria sin alterar el número de filas.',
  },
];

export const Step5ClassBalance: React.FC<Step5Props> = ({
  count0,
  count1,
  positiveClass,
  targetCol,
  balanceMethod,
  onChangeBalance,
  trainOriginal0,
  trainOriginal1,
  trainBalanced0,
  trainBalanced1,
}) => {
  const total = count0 + count1;
  const pct0 = total > 0 ? count0 / total : 0;
  const pct1 = total > 0 ? count1 / total : 0;
  const minorityPct = Math.min(pct0, pct1);
  const needsBalance = minorityPct < 0.2;

  const chartData = [
    {
      etapa: 'Base completa',
      clase0: count0,
      clase1: count1,
    },
    {
      etapa: 'Train original',
      clase0: trainOriginal0,
      clase1: trainOriginal1,
    },
    {
      etapa: 'Train después de balanceo',
      clase0: trainBalanced0,
      clase1: trainBalanced1,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Distribución actual de la variable objetivo ({targetCol})
          </h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <div className="text-xs text-slate-500">Clase 0 (Negativa)</div>
              <div className="mt-1 font-mono text-2xl font-bold text-slate-900 tabular-nums">
                {formatIntCO(count0)}
              </div>
              <div className="text-xs font-semibold text-slate-600 tabular-nums">
                {formatPercentCO(pct0, 1)} del total
              </div>
            </div>
            <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3.5">
              <div className="text-xs text-blue-800">Clase 1 (Positiva: {positiveClass})</div>
              <div className="mt-1 font-mono text-2xl font-bold text-blue-900 tabular-nums">
                {formatIntCO(count1)}
              </div>
              <div className="text-xs font-semibold text-blue-700 tabular-nums">
                {formatPercentCO(pct1, 1)} del total
              </div>
            </div>
          </div>

          {needsBalance ? (
            <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-950">
              <AlertCircle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-bold">Recomendación: aplicar balanceo. </span>
                La clase minoritaria representa el {formatPercentCO(minorityPct, 1)} (menor al umbral del 20%). Se sugiere probar SMOTE, sobremuestreo o pesos por clase en entrenamiento.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-xs text-emerald-950">
              <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0 mt-0.5" aria-hidden="true" />
              <div>
                <span className="font-bold">Desbalance moderado ({formatPercentCO(minorityPct, 1)} ≥ 20%). </span>
                El modelo puede entrenarse sin balanceo (usando el punto de corte para ajustar sensibilidad), aunque puedes experimentar con balanceo en el Paso 13 para ver si mejora el F1.
              </div>
            </div>
          )}

          <div className="h-52 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="etapa" tick={{ fontSize: 11, fill: '#475569' }} />
                <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                <Tooltip formatter={(v: unknown) => formatIntCO(Number(v))} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="clase0" name="Clase 0" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                <Bar dataKey="clase1" name="Clase 1" fill="#1D4ED8" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Estrategia de balanceo (SOLO en Entrenamiento)
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Los datos de prueba jamás se balancean para conservar una evaluación realista del negocio.
            </p>
          </div>

          <div className="space-y-2">
            {BALANCE_OPTIONS.map((opt) => {
              const active = balanceMethod === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onChangeBalance(opt.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? 'border-blue-700 bg-blue-50/60'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-900">{opt.name}</span>
                    <span
                      className={`text-[11px] font-semibold ${
                        active ? 'text-blue-700' : 'text-slate-400'
                      }`}
                    >
                      {active ? 'Activo' : 'Seleccionar'}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 6: PREPARACIÓN (FACTORES, DUMMIES n-1 Y SELECCIÓN DE VARIABLES)
   ============================================================================ */
interface Step6Props {
  profiles: ColumnProfile[];
  targetCol: string;
  selectedPredictors: string[];
  userTypes: Record<string, VariableRoleType>;
  referenceCategories: Record<string, string>;
  encodedFeatures: EncodedFeatureInfo[];
  onTogglePredictor: (col: string) => void;
  onChangeVariableType: (col: string, nextType: VariableRoleType) => void;
  onChangeReferenceCategory: (col: string, refVal: string) => void;
}

export const Step6Preparation: React.FC<Step6Props> = ({
  profiles,
  targetCol,
  selectedPredictors,
  userTypes,
  referenceCategories,
  encodedFeatures,
  onTogglePredictor,
  onChangeVariableType,
  onChangeReferenceCategory,
}) => {
  const predictorProfiles = profiles.filter((p) => p.name !== targetCol);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4 flex items-start gap-3">
        <Info className="h-5 w-5 text-blue-700 shrink-0 mt-0.5" aria-hidden="true" />
        <div className="text-xs text-slate-700 leading-relaxed">
          <span className="font-bold text-slate-900">
            Regla clave de preparación (Factor y Variables Dummy n − 1):{' '}
          </span>
          Un código numérico como <span className="font-mono font-semibold">TIPO_ips</span> (1 a 5) representa categorías, no cantidades reales (el tipo 2 no vale el doble del tipo 1, ni el promedio de tipos tiene sentido). Al marcarlo como <span className="font-semibold">Categórica (Factor)</span>, se crean <span className="font-semibold">n − 1 columnas dummy</span> respecto a la categoría de referencia y se retira automáticamente la columna original para evitar duplicación y colinealidad exacta.
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Selección de variables predictoras y codificación
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Decide bajo criterio del investigador qué variables entran al modelo, su rol (Numérica vs. Factor) y la categoría de referencia para las dummies.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2 text-left font-semibold">Incluir</th>
                <th className="px-3 py-2 text-left font-semibold">Variable</th>
                <th className="px-3 py-2 text-left font-semibold">Rol en el modelo</th>
                <th className="px-3 py-2 text-left font-semibold">Categoría de referencia (Factor)</th>
                <th className="px-3 py-2 text-right font-semibold">Columnas resultantes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {predictorProfiles.map((prof) => {
                const isIncluded = selectedPredictors.includes(prof.name);
                const role = userTypes[prof.name] ?? prof.userType;
                const isCat = role === 'categorical';
                const levels = prof.uniqueValues;
                const refCat =
                  referenceCategories[prof.name] && levels.includes(referenceCategories[prof.name])
                    ? referenceCategories[prof.name]
                    : levels[0] ?? '';
                const resultingCols = !isIncluded
                  ? 0
                  : isCat
                    ? Math.max(0, levels.length - 1)
                    : 1;
                const canBeNumeric = prof.inferredType === 'numeric';

                return (
                  <tr
                    key={prof.name}
                    className={isIncluded ? 'bg-white hover:bg-slate-50/70' : 'bg-slate-50/60 opacity-70'}
                  >
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={isIncluded}
                        onChange={() => onTogglePredictor(prof.name)}
                        aria-label={`Incluir ${prof.name}`}
                        className="h-4 w-4 rounded border-slate-300 text-blue-700 focus:ring-blue-700"
                      />
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="font-semibold text-slate-900">{prof.name}</div>
                      <div className="text-[11px] text-slate-500 tabular-nums">
                        {prof.uniqueCount} valores distintos
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5">
                        <button
                          type="button"
                          disabled={!canBeNumeric}
                          onClick={() => onChangeVariableType(prof.name, 'numeric')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            !isCat
                              ? 'bg-white text-slate-900 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                          }`}
                        >
                          Numérica
                        </button>
                        <button
                          type="button"
                          disabled={prof.uniqueCount > 25}
                          onClick={() => onChangeVariableType(prof.name, 'categorical')}
                          className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                            isCat
                              ? 'bg-white text-blue-800 shadow-xs font-semibold'
                              : 'text-slate-600 hover:text-slate-900 disabled:opacity-40'
                          }`}
                        >
                          Factor (Dummies)
                        </button>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      {isCat ? (
                        <select
                          value={refCat}
                          disabled={!isIncluded}
                          onChange={(e) => onChangeReferenceCategory(prof.name, e.target.value)}
                          className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-900 focus:border-blue-700 focus:outline-none"
                        >
                          {levels.map((lvl) => (
                            <option key={lvl} value={lvl}>
                              Referencia: {lvl}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-slate-400">No aplica (numérica continua)</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-800">
                      {resultingCols}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Columnas finales en la matriz de diseño */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-2">
          <Layers className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <h3 className="text-sm font-bold text-slate-900">
            Matriz final que entra a glm() ({encodedFeatures.length} columnas predictoras sin duplicados)
          </h3>
        </div>
        <div className="flex flex-wrap gap-2 text-xs font-mono">
          {encodedFeatures.map((f) => (
            <span
              key={f.featureName}
              className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-800"
            >
              {f.featureName}
              {f.isDummy ? ` (ref: ${f.referenceCategory})` : ''}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 7: DIVISIÓN ENTRENAMIENTO Y PRUEBA CON SEMILLA
   ============================================================================ */
interface Step7Props {
  trainRatio: number;
  seed: number;
  onChangeTrainRatio: (ratio: number) => void;
  onChangeSeed: (seed: number) => void;
  trainCount: number;
  trainOnes: number;
  testCount: number;
  testOnes: number;
  balancedTrainCount: number;
  balancedTrainOnes: number;
  balanceMethod: BalanceMethod;
  droppedRowCount: number;
}

export const Step7Split: React.FC<Step7Props> = ({
  trainRatio,
  seed,
  onChangeTrainRatio,
  onChangeSeed,
  trainCount,
  trainOnes,
  testCount,
  testOnes,
  balancedTrainCount,
  balancedTrainOnes,
  balanceMethod,
  droppedRowCount,
}) => {
  const trainPctOnes = trainCount > 0 ? trainOnes / trainCount : 0;
  const testPctOnes = testCount > 0 ? testOnes / testCount : 0;
  const balPctOnes = balancedTrainCount > 0 ? balancedTrainOnes / balancedTrainCount : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-5">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              Proporción Entrenamiento / Prueba
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Se utiliza muestreo estratificado (equivalente a createDataPartition en R) para mantener el mismo porcentaje de casos positivos en ambos conjuntos.
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { ratio: 0.7, label: '70% / 30%' },
                { ratio: 0.75, label: '75% / 25% (Defecto)' },
                { ratio: 0.8, label: '80% / 20%' },
              ].map((opt) => {
                const active = Math.abs(trainRatio - opt.ratio) < 0.01;
                return (
                  <button
                    key={opt.ratio}
                    type="button"
                    onClick={() => onChangeTrainRatio(opt.ratio)}
                    className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-colors ${
                      active
                        ? 'border-blue-700 bg-blue-50 text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="input-seed" className="block text-sm font-semibold text-slate-900">
              Semilla aleatoria (set.seed)
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Permite repetir exactamente la misma partición en cualquier momento.
            </p>
            <div className="mt-2 flex items-center gap-2">
              <input
                id="input-seed"
                type="number"
                value={seed}
                onChange={(e) => onChangeSeed(Number(e.target.value) || 123)}
                className="w-36 rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => onChangeSeed(Math.floor(100 + Math.random() * 8999))}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Nueva semilla</span>
              </button>
            </div>
          </div>

          {droppedRowCount > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-900">
              Nota: Se omitieron automáticamente {formatIntCO(droppedRowCount)} filas con valores faltantes (NA) en las columnas seleccionadas, igual que na.omit() en R.
            </div>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <h2 className="text-base font-bold text-slate-900">
            Resultado de la partición estratificada
          </h2>

          <div className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Entrenamiento ({Math.round(trainRatio * 100)}%)
                </span>
                <span className="font-mono text-sm font-bold text-blue-800 tabular-nums">
                  {formatIntCO(trainCount)} casos
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-600 tabular-nums">
                <span>Casos con Y = 1: {formatIntCO(trainOnes)}</span>
                <span className="font-semibold text-slate-900">
                  Proporción de unos: {formatPercentCO(trainPctOnes, 1)}
                </span>
              </div>
            </div>

            {balanceMethod !== 'none' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-4">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm font-bold text-blue-950">
                    Entrenamiento después de balanceo ({balanceMethod})
                  </span>
                  <span className="font-mono text-sm font-bold text-blue-800 tabular-nums">
                    {formatIntCO(balancedTrainCount)} casos
                  </span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-blue-900 tabular-nums">
                  <span>Casos con Y = 1: {formatIntCO(balancedTrainOnes)}</span>
                  <span className="font-semibold">
                    Proporción de unos: {formatPercentCO(balPctOnes, 1)}
                  </span>
                </div>
              </div>
            )}

            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900">
                  Prueba ({Math.round((1 - trainRatio) * 100)}%) — sin balancear
                </span>
                <span className="font-mono text-sm font-bold text-slate-900 tabular-nums">
                  {formatIntCO(testCount)} casos
                </span>
              </div>
              <div className="mt-1 flex justify-between text-xs text-slate-600 tabular-nums">
                <span>Casos con Y = 1: {formatIntCO(testOnes)}</span>
                <span className="font-semibold text-slate-900">
                  Proporción de unos: {formatPercentCO(testPctOnes, 1)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 8: MODELO LOGÍSTICO, COEFICIENTES, p-value, ODDS RATIOS Y AIC
   ============================================================================ */
interface Step8Props {
  model: LogisticModelResult;
  targetOutcomeName: string;
}

export const Step8Model: React.FC<Step8Props> = ({ model, targetOutcomeName }) => {
  const equationTerms = model.coefficients
    .slice(0, 5)
    .map((c, idx) => {
      const val = formatNumberCO(c.estimate, 3);
      if (idx === 0) return val;
      const sign = c.estimate >= 0 ? ' + ' : ' − ';
      return `${sign}${formatNumberCO(Math.abs(c.estimate), 3)}·${c.name}`;
    })
    .join('');

  return (
    <div className="space-y-6">
      {/* Explicación de los 2 pasos matemáticos */}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-blue-700">Paso matemático 1: Puntaje lineal</div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
            z = b₀ + b₁·X₁ + b₂·X₂ + …
          </div>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            Funciona igual que una regresión lineal múltiple: suma el intercepto más cada variable multiplicada por su peso.
          </p>
          <div className="mt-2 rounded bg-slate-50 border border-slate-200 px-2.5 py-1.5 font-mono text-[11px] text-slate-700 overflow-x-auto whitespace-nowrap">
            z = {equationTerms}
            {model.coefficients.length > 5 ? ' + …' : ''}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-xs font-semibold text-blue-700">
            Paso matemático 2: Función logística (Sigmoide)
          </div>
          <div className="mt-1 font-mono text-sm font-semibold text-slate-900">
            p = 1 / (1 + e^(−z))
          </div>
          <p className="mt-1.5 text-xs text-slate-600 leading-relaxed">
            Transforma cualquier puntaje z en una probabilidad garantizada entre 0% y 100%. Estimado por Máxima Verosimilitud (IRLS / Newton-Raphson).
          </p>
          <div className="mt-2 grid grid-cols-3 gap-2 border-t border-slate-100 pt-2 text-xs">
            <div>
              <span className="text-slate-500">AIC: </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatNumberCO(model.aic, 1)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Pseudo-R²: </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {formatNumberCO(model.pseudoR2McFadden, 3)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Iteraciones: </span>
              <span className="font-mono font-bold text-slate-900 tabular-nums">
                {model.iterations}
              </span>
            </div>
          </div>
        </div>
      </div>

      {model.warnings.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900 space-y-1">
          {model.warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      )}

      {/* Tabla summary(modelo) + exp(coef(modelo)) */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 className="text-base font-bold text-slate-900">
            Tabla de coeficientes, p-values y Odds Ratios (equivalente a summary(modelo))
          </h2>
          <span className="text-xs text-slate-500">
            Resaltado en verde cuando p &lt; 0,05 (evidencia estadística sólida)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                <th className="px-3 py-2.5 text-left font-semibold">Variable</th>
                <th className="px-3 py-2.5 text-right font-semibold">Estimación (b)</th>
                <th className="px-3 py-2.5 text-right font-semibold">Error estándar</th>
                <th className="px-3 py-2.5 text-right font-semibold">Estadístico z</th>
                <th className="px-3 py-2.5 text-right font-semibold">p-value</th>
                <th className="px-3 py-2.5 text-right font-semibold">Odds Ratio (e^b)</th>
                <th className="px-3 py-2.5 text-left font-semibold">Interpretación en negocio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {model.coefficients.map((c) => {
                const isSig = !c.isIntercept && c.pValue < 0.05;
                return (
                  <tr key={c.name} className="hover:bg-slate-50/60 align-top">
                    <td className="px-3 py-2.5 font-mono font-semibold text-slate-900 whitespace-nowrap">
                      {c.name}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-800">
                      {formatFlexibleCO(c.estimate, 4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-600">
                      {formatFlexibleCO(c.stdError, 4)}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums text-slate-700">
                      {formatNumberCO(c.zValue, 3)}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-mono tabular-nums whitespace-nowrap ${
                        c.pValue < 0.05
                          ? 'bg-emerald-50 text-emerald-800 font-bold'
                          : 'text-slate-500'
                      }`}
                    >
                      {formatPValueCO(c.pValue)}
                      {isSig ? ' *' : ''}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono tabular-nums font-semibold text-blue-900">
                      {c.isIntercept ? '—' : formatNumberCO(c.oddsRatio, 3)}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700 leading-relaxed min-w-[260px]">
                      {interpretCoefficientPlainSpanish(c, targetOutcomeName)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-3 text-xs text-slate-600 tabular-nums">
          <span>
            Devianza nula: <strong className="font-mono">{formatNumberCO(model.nullDeviance, 1)}</strong>
          </span>
          <span>
            Devianza residual: <strong className="font-mono">{formatNumberCO(model.residualDeviance, 1)}</strong>
          </span>
          <span>
            AIC: <strong className="font-mono text-slate-900">{formatNumberCO(model.aic, 1)}</strong>
          </span>
          <span>
            Observaciones en entrenamiento: <strong className="font-mono">{formatIntCO(model.nObsTrain)}</strong>
          </span>
        </div>
      </div>
    </div>
  );
};
