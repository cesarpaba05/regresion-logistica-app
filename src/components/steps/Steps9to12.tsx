import React from 'react';
import { AlertTriangle, CheckCircle2, Sliders, TrendingUp } from 'lucide-react';
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ConfusionEvaluation,
  LiftPoint,
  ProfitConfig,
  ProfitCurvePoint,
  RocPoint,
} from '../../types/model';
import { sigmoid } from '../../utils/logisticRegression';
import {
  formatCurrencyCO,
  formatIntCO,
  formatNumberCO,
  formatPercentCO,
} from '../../utils/formatters';
import { ConfusionMatrixCard } from '../ConfusionMatrixCard';

/* ============================================================================
   PASO 9: CURVA S Y PUNTO DE CORTE
   ============================================================================ */
interface Step9Props {
  zTest: number[];
  yTest: number[];
  pTest: number[];
  threshold: number;
  onChangeThreshold: (t: number) => void;
  testEval: ConfusionEvaluation;
}

export const Step9SCurve: React.FC<Step9Props> = ({
  zTest,
  yTest,
  threshold,
  onChangeThreshold,
  testEval,
}) => {
  // Rango dinámico de z para dibujar la curva S suave
  const minZ = zTest.length > 0 ? Math.min(-5, Math.floor(Math.min(...zTest) - 0.5)) : -6;
  const maxZ = zTest.length > 0 ? Math.max(5, Math.ceil(Math.max(...zTest) + 0.5)) : 6;
  const clampedMinZ = Math.max(-10, minZ);
  const clampedMaxZ = Math.min(10, maxZ);

  const curvePoints = [];
  const steps = 60;
  for (let i = 0; i <= steps; i++) {
    const z = clampedMinZ + ((clampedMaxZ - clampedMinZ) * i) / steps;
    curvePoints.push({
      z: Number(z.toFixed(2)),
      curvaS: Number(sigmoid(z).toFixed(4)),
    });
  }

  // Puntos reales (submuestreados a máx 200 para legibilidad del gráfico)
  const stride = Math.max(1, Math.floor(zTest.length / 200));
  const casesZero: Array<{ z: number; casoReal: number }> = [];
  const casesOne: Array<{ z: number; casoReal: number }> = [];

  for (let i = 0; i < zTest.length; i += stride) {
    const zClamped = Math.max(clampedMinZ, Math.min(clampedMaxZ, zTest[i]));
    if (yTest[i] === 1) {
      casesOne.push({ z: Number(zClamped.toFixed(2)), casoReal: 1 });
    } else {
      casesZero.push({ z: Number(zClamped.toFixed(2)), casoReal: 0 });
    }
  }

  const zAtThreshold = Math.log(threshold / (1 - threshold));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 className="text-base font-bold text-slate-900">
              Curva logística (S) y clasificación según punto de corte
            </h2>
            <span className="font-mono text-xs text-blue-800 font-semibold tabular-nums">
              Corte actual = {formatNumberCO(threshold, 2)} (z = {formatNumberCO(zAtThreshold, 2)})
            </span>
          </div>

          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart margin={{ top: 12, right: 18, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  type="number"
                  dataKey="z"
                  domain={[clampedMinZ, clampedMaxZ]}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{
                    value: 'Puntaje lineal z = b₀ + b₁X₁ + …',
                    position: 'insideBottom',
                    offset: -8,
                    fontSize: 11,
                    fill: '#475569',
                  }}
                />
                <YAxis
                  type="number"
                  domain={[0, 1]}
                  tickFormatter={(v) => `${Math.round(v * 100)}%`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  formatter={(value: unknown, name: unknown) => [
                    formatPercentCO(Number(value), 1),
                    String(name),
                  ]}
                  labelFormatter={(lbl) => `Puntaje z: ${formatNumberCO(Number(lbl), 2)}`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                <ReferenceLine
                  y={threshold}
                  stroke="#B45309"
                  strokeDasharray="5 4"
                  strokeWidth={2}
                  label={{
                    value: `Corte ${formatNumberCO(threshold, 2)}`,
                    position: 'insideTopRight',
                    fill: '#B45309',
                    fontSize: 11,
                  }}
                />
                <Line
                  data={curvePoints}
                  type="monotone"
                  dataKey="curvaS"
                  name="Probabilidad p(z)"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Scatter
                  data={casesZero}
                  dataKey="casoReal"
                  name="Casos reales = 0"
                  fill="#64748B"
                  fillOpacity={0.55}
                />
                <Scatter
                  data={casesOne}
                  dataKey="casoReal"
                  name="Casos reales = 1"
                  fill="#DC2626"
                  fillOpacity={0.75}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Ajustar punto de corte</h2>
          </div>

          <div>
            <div className="flex items-baseline justify-between mb-1.5">
              <label htmlFor="threshold-slider" className="text-xs font-medium text-slate-600">
                Umbral para decidir "Sí (1)"
              </label>
              <span className="font-mono text-lg font-bold text-blue-800 tabular-nums">
                {formatNumberCO(threshold, 2)}
              </span>
            </div>
            <input
              id="threshold-slider"
              type="range"
              min={0.05}
              max={0.95}
              step={0.01}
              value={threshold}
              onChange={(e) => onChangeThreshold(Number(e.target.value))}
              className="w-full accent-blue-700 cursor-pointer"
            />
            <div className="flex justify-between text-[11px] text-slate-400 font-mono tabular-nums mt-1">
              <span>0,05 (más alertas)</span>
              <span>0,50</span>
              <span>0,95 (más estricto)</span>
            </div>
            <button
              type="button"
              onClick={() => onChangeThreshold(0.5)}
              className="mt-2 text-xs font-semibold text-blue-700 hover:underline"
            >
              Restablecer a 0,50 por defecto
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 border-t border-slate-200 pt-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[11px] text-slate-500">Accuracy (Prueba)</div>
              <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                {formatPercentCO(testEval.accuracy, 1)}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50/60 border border-blue-200 p-2.5">
              <div className="text-[11px] text-blue-800">F1 Clase 1 (Prueba)</div>
              <div className="font-mono text-base font-bold text-blue-900 tabular-nums">
                {formatPercentCO(testEval.class1.f1, 1)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[11px] text-slate-500">Recall / Sensibilidad</div>
              <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                {formatPercentCO(testEval.class1.recall, 1)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2.5">
              <div className="text-[11px] text-slate-500">Precisión Clase 1</div>
              <div className="font-mono text-base font-bold text-slate-900 tabular-nums">
                {formatPercentCO(testEval.class1.precision, 1)}
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
            <strong>Criterio del investigador:</strong> El punto de corte no es fijo en 0,50. Se decide mirando dónde cambia la curvatura y equilibrando las falsas alarmas frente a los casos no detectados, igual que el método del codo en clustering.
          </p>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 10: MATRIZ DE CONFUSIÓN (ENTRENAMIENTO VS PRUEBA)
   ============================================================================ */
interface Step10Props {
  trainEval: ConfusionEvaluation;
  testEval: ConfusionEvaluation;
  threshold: number;
  onChangeThreshold: (t: number) => void;
  positiveClass: string;
}

export const Step10ConfusionMatrix: React.FC<Step10Props> = ({
  trainEval,
  testEval,
  threshold,
  onChangeThreshold,
  positiveClass,
}) => {
  const accuracyParadox =
    (testEval.accuracy >= 0.7 && testEval.class1.f1 < 0.5) ||
    testEval.accuracy - testEval.class1.f1 > 0.25;

  const overfittingAlert =
    trainEval.class1.f1 - testEval.class1.f1 > 0.08 ||
    trainEval.accuracy - testEval.accuracy > 0.08;

  return (
    <div className="space-y-5">
      {/* Control rápido de corte + aclaración de R */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="text-xs text-slate-700 max-w-2xl leading-relaxed">
          <span className="font-bold text-slate-900">Aclaración importante sobre R: </span>
          En R, <span className="font-mono">table(prediccion, real)</span> y{' '}
          <span className="font-mono">caret::confusionMatrix()</span> muestran la{' '}
          <strong>predicción en filas</strong> y el <strong>valor real en columnas</strong> (al revés). Aquí ubicamos el <strong>valor real en filas</strong> y la <strong>predicción en columnas</strong> porque resulta más intuitivo para leer qué porcentaje de casos reales logró capturar el modelo.
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <label htmlFor="cm-thresh" className="text-xs font-semibold text-slate-700">
            Corte:
          </label>
          <input
            id="cm-thresh"
            type="range"
            min={0.05}
            max={0.95}
            step={0.01}
            value={threshold}
            onChange={(e) => onChangeThreshold(Number(e.target.value))}
            className="w-28 accent-blue-700"
          />
          <span className="font-mono text-xs font-bold text-blue-800 tabular-nums w-10">
            {formatNumberCO(threshold, 2)}
          </span>
        </div>
      </div>

      {/* Alertas automáticas: accuracy engaña / sobreajuste */}
      {accuracyParadox && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50/80 p-4 text-xs text-amber-950">
          <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-bold text-sm text-amber-950">
              ¡Alerta: la accuracy engaña!
            </div>
            <p className="mt-1 leading-relaxed">
              La accuracy global en prueba es alta ({formatPercentCO(testEval.accuracy, 1)}), pero el F1 de la clase de interés es bajo ({formatPercentCO(testEval.class1.f1, 1)}). Esto ocurre cuando la clase 0 domina la base: el modelo acierta muchos ceros fáciles mientras falla en detectar los casos positivos que realmente importan al negocio. Prueba bajar el punto de corte o aplicar balanceo en el Paso 5.
            </p>
          </div>
        </div>
      )}

      {overfittingAlert && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-950">
          <AlertTriangle className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <div className="font-bold text-sm text-rose-950">
              Posible sobreajuste (el modelo empeora en Prueba frente a Entrenamiento)
            </div>
            <p className="mt-1 leading-relaxed">
              El desempeño en Entrenamiento (F1 = {formatPercentCO(trainEval.class1.f1, 1)}) cae significativamente al evaluar casos nuevos en Prueba (F1 = {formatPercentCO(testEval.class1.f1, 1)}). Revisa si incluiste demasiadas variables poco significativas en el Paso 6.
            </p>
          </div>
        </div>
      )}

      {/* Matrices lado a lado */}
      <div className="grid gap-5 lg:grid-cols-2">
        <ConfusionMatrixCard
          title="Matriz de Confusión – Entrenamiento"
          subtitle={`n = ${formatIntCO(trainEval.total)} casos`}
          evaluation={trainEval}
          positiveLabel={positiveClass}
          negativeLabel="No"
        />
        <ConfusionMatrixCard
          title="Matriz de Confusión – Prueba (Datos nuevos)"
          subtitle={`n = ${formatIntCO(testEval.total)} casos`}
          evaluation={testEval}
          positiveLabel={positiveClass}
          negativeLabel="No"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 text-xs text-slate-700 leading-relaxed">
        <strong>¿Qué nivel de desempeño es aceptable?</strong> Depende del contexto de negocio: en campañas masivas de marketing o cobranza preventiva, una precisión o F1 alrededor del <strong>70%</strong> suele generar alto retorno sobre la inversión; en diagnóstico médico o seguridad crítica se exige entre <strong>90% y 99%</strong>.
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 11: CURVA ROC CON AUC Y GRÁFICO LIFT
   ============================================================================ */
interface Step11Props {
  rocPoints: RocPoint[];
  aucTest: number;
  liftPoints: LiftPoint[];
}

export const Step11RocLift: React.FC<Step11Props> = ({ rocPoints, aucTest, liftPoints }) => {
  const rocChartData = rocPoints.map((pt) => ({
    fpr: Number((pt.fpr * 100).toFixed(1)),
    tpr: Number((pt.tpr * 100).toFixed(1)),
    azar: Number((pt.fpr * 100).toFixed(1)),
  }));

  const liftAt10 = liftPoints.find((l) => l.pctContacted === 10);
  const liftAt20 = liftPoints.find((l) => l.pctContacted === 20);
  const liftAt30 = liftPoints.find((l) => l.pctContacted === 30);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-2">
        {/* Curva ROC */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">Curva ROC (Datos de Prueba)</h2>
              <p className="text-xs text-slate-500">
                Sensibilidad vs. Falsas alarmas en todos los puntos de corte
              </p>
            </div>
            <div className="text-right">
              <div className="text-[11px] text-slate-500">AUC</div>
              <div className="font-mono text-lg font-bold text-blue-800 tabular-nums">
                {formatNumberCO(aucTest, 3)}
              </div>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rocChartData} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="fpr"
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{
                    value: 'Tasa de Falsos Positivos (1 − Especificidad)',
                    position: 'insideBottom',
                    offset: -8,
                    fontSize: 11,
                    fill: '#475569',
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [`${formatNumberCO(Number(v), 1)}%`, String(name)]}
                  labelFormatter={(lbl) => `Falsas alarmas: ${lbl}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line
                  type="monotone"
                  dataKey="tpr"
                  name="Modelo Logístico"
                  stroke="#1D4ED8"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="linear"
                  dataKey="azar"
                  name="Azar (AUC = 0,50)"
                  stroke="#94A3B8"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Gráfico Lift / Ganancia acumulada */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Curva de Ganancia Acumulada / Lift
              </h2>
              <p className="text-xs text-slate-500">
                % de la base contactada (ordenada por riesgo) vs. % de positivos encontrados
              </p>
            </div>
            {liftAt20 && (
              <div className="text-right">
                <div className="text-[11px] text-slate-500">Lift al Top 20%</div>
                <div className="font-mono text-lg font-bold text-emerald-700 tabular-nums">
                  {formatNumberCO(liftAt20.lift, 2)}x
                </div>
              </div>
            )}
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={liftPoints} margin={{ top: 8, right: 16, left: 0, bottom: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis
                  dataKey="pctContacted"
                  type="number"
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                  label={{
                    value: '% de la base contactada (mayor a menor riesgo)',
                    position: 'insideBottom',
                    offset: -8,
                    fontSize: 11,
                    fill: '#475569',
                  }}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fontSize: 11, fill: '#475569' }}
                />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => [`${formatNumberCO(Number(v), 1)}%`, String(name)]}
                  labelFormatter={(lbl) => `Base contactada: ${lbl}%`}
                />
                <Legend wrapperStyle={{ fontSize: 11, paddingTop: 6 }} />
                <Line
                  type="monotone"
                  dataKey="pctPositivesFound"
                  name="Con el modelo"
                  stroke="#15803D"
                  strokeWidth={2.5}
                  dot={{ r: 2.5 }}
                />
                <Line
                  type="linear"
                  dataKey="pctRandomFound"
                  name="Escoger al azar"
                  stroke="#94A3B8"
                  strokeDasharray="5 4"
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Lectura de negocio del Lift */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-3">
          Lectura comercial de priorización (Lift en Prueba)
        </h3>
        <div className="grid gap-3 md:grid-cols-3">
          {[liftAt10, liftAt20, liftAt30]
            .filter((x): x is LiftPoint => Boolean(x))
            .map((pt) => (
              <div key={pt.pctContacted} className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
                <div className="text-xs font-semibold text-slate-600">
                  Contactando solo el Top {pt.pctContacted}% ({formatIntCO(pt.casesCount)} casos)
                </div>
                <div className="mt-1 font-mono text-xl font-bold text-emerald-800 tabular-nums">
                  {formatNumberCO(pt.pctPositivesFound, 1)}% de los positivos
                </div>
                <div className="mt-0.5 text-xs text-slate-600 tabular-nums">
                  Lift = <strong className="font-mono">{formatNumberCO(pt.lift, 2)}x</strong> mejor que llamar al azar
                </div>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 12: GANANCIA NETA Y CORTE ÓPTIMO
   ============================================================================ */
interface Step12Props {
  profitConfig: ProfitConfig;
  onChangeProfitConfig: (cfg: ProfitConfig) => void;
  profitCurve: ProfitCurvePoint[];
  bestPoint: ProfitCurvePoint;
  currentThreshold: number;
  onApplyOptimalThreshold: (t: number) => void;
}

export const Step12Profit: React.FC<Step12Props> = ({
  profitConfig,
  onChangeProfitConfig,
  profitCurve,
  bestPoint,
  currentThreshold,
  onApplyOptimalThreshold,
}) => {
  const currentPoint =
    profitCurve.find((pt) => Math.abs(pt.threshold - currentThreshold) < 0.006) ?? bestPoint;

  const chartData = profitCurve.map((p) => ({
    corte: Number(p.threshold.toFixed(2)),
    ganancia: Math.round(p.profit),
  }));

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Parámetros financieros */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Matriz económica del negocio</h2>
          </div>

          <div>
            <label htmlFor="inp-btp" className="block text-xs font-semibold text-slate-800">
              Beneficio neto de un Verdadero Positivo (COP)
            </label>
            <p className="text-[11px] text-slate-500">
              Lo que ahorras o ganas al detectar y gestionar a tiempo un caso real.
            </p>
            <input
              id="inp-btp"
              type="number"
              step={50000}
              value={profitConfig.benefitTP}
              onChange={(e) =>
                onChangeProfitConfig({ ...profitConfig, benefitTP: Number(e.target.value) || 0 })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="inp-cfp" className="block text-xs font-semibold text-slate-800">
              Costo de un Falso Positivo / falsa alarma (COP)
            </label>
            <p className="text-[11px] text-slate-500">
              Costo de llamar, visitar u otorgar descuento a un cliente que sí iba a cumplir.
            </p>
            <input
              id="inp-cfp"
              type="number"
              step={10000}
              value={profitConfig.costFP}
              onChange={(e) =>
                onChangeProfitConfig({ ...profitConfig, costFP: Number(e.target.value) || 0 })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="inp-cfn" className="block text-xs font-semibold text-slate-800">
              Costo de un Falso Negativo / no detectado (COP)
            </label>
            <p className="text-[11px] text-slate-500">
              Pérdida por no detectar el caso (intereses de préstamo, cartera vencida o pérdida del cliente).
            </p>
            <input
              id="inp-cfn"
              type="number"
              step={50000}
              value={profitConfig.costFN}
              onChange={(e) =>
                onChangeProfitConfig({ ...profitConfig, costFN: Number(e.target.value) || 0 })
              }
              className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        {/* Gráfico ganancia vs corte */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5 flex flex-col justify-between">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 className="text-base font-bold text-slate-900">
                Ganancia neta esperada según punto de corte (en Prueba)
              </h2>
              <span className="font-mono text-xs font-bold text-emerald-700 tabular-nums">
                Máximo en corte = {formatNumberCO(bestPoint.threshold, 2)} (
                {formatCurrencyCO(bestPoint.profit)})
              </span>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 10, right: 20, left: 16, bottom: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="corte"
                    type="number"
                    domain={[0.05, 0.95]}
                    tickFormatter={(v) => formatNumberCO(Number(v), 2)}
                    tick={{ fontSize: 11, fill: '#475569' }}
                    label={{
                      value: 'Punto de corte (probabilidad umbral)',
                      position: 'insideBottom',
                      offset: -8,
                      fontSize: 11,
                      fill: '#475569',
                    }}
                  />
                  <YAxis
                    tickFormatter={(v) => `${formatNumberCO(Number(v) / 1000000, 1)}M`}
                    tick={{ fontSize: 11, fill: '#475569' }}
                  />
                  <Tooltip
                    formatter={(v: unknown) => [formatCurrencyCO(Number(v)), 'Ganancia neta']}
                    labelFormatter={(lbl) => `Punto de corte: ${formatNumberCO(Number(lbl), 2)}`}
                  />
                  <ReferenceLine
                    x={bestPoint.threshold}
                    stroke="#15803D"
                    strokeDasharray="4 4"
                    strokeWidth={2}
                  />
                  <ReferenceLine y={0} stroke="#CBD5E1" />
                  <Line
                    type="monotone"
                    dataKey="ganancia"
                    name="Ganancia neta"
                    stroke="#1D4ED8"
                    strokeWidth={2.5}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5">
            <div className="text-xs text-slate-800 space-y-0.5">
              <div>
                <strong>Corte actual ({formatNumberCO(currentThreshold, 2)}):</strong>{' '}
                <span className="font-mono font-semibold">{formatCurrencyCO(currentPoint.profit)}</span>
              </div>
              <div>
                <strong>Corte óptimo sugerido ({formatNumberCO(bestPoint.threshold, 2)}):</strong>{' '}
                <span className="font-mono font-bold text-emerald-800">
                  {formatCurrencyCO(bestPoint.profit)}
                </span>{' '}
                ({formatIntCO(bestPoint.tp)} VP, {formatIntCO(bestPoint.fp)} FP, {formatIntCO(bestPoint.fn)} FN)
              </div>
            </div>

            {Math.abs(currentThreshold - bestPoint.threshold) >= 0.01 ? (
              <button
                type="button"
                onClick={() => onApplyOptimalThreshold(bestPoint.threshold)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-800 whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Aplicar corte óptimo ({formatNumberCO(bestPoint.threshold, 2)})</span>
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                <span>Ya estás usando el corte óptimo</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
