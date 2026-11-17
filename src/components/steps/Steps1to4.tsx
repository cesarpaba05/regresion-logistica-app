import React, { useMemo, useRef } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Trash2,
  Upload,
  Wrench,
} from 'lucide-react';
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
  BusinessContext,
  ColumnProfile,
  DataAnomaly,
  RawRow,
} from '../../types/model';
import {
  GroupComparisonRow,
  inferRawRType,
  isMissingValue,
  parseUploadedDataset,
  toNumericValue,
} from '../../utils/dataProfiler';
import { computeLinearRegressionWarningMetrics } from '../../utils/logisticRegression';
import {
  formatFlexibleCO,
  formatIntCO,
  formatNumberCO,
  formatPercentCO,
  formatPValueCO,
} from '../../utils/formatters';

/* ============================================================================
   PASO 1: PREGUNTA DE NEGOCIO
   ============================================================================ */
interface Step1Props {
  context: BusinessContext;
  onChange: (next: BusinessContext) => void;
}

export const Step1Business: React.FC<Step1Props> = ({ context, onChange }) => {
  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label htmlFor="ctx-industria" className="block text-sm font-semibold text-slate-900">
              Contexto del problema
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Describe quién usará el modelo y qué necesidad operativa busca resolver.
            </p>
            <textarea
              id="ctx-industria"
              rows={3}
              value={context.contextoIndustria}
              onChange={(e) => onChange({ ...context, contextoIndustria: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ctx-pregunta" className="block text-sm font-semibold text-slate-900">
              Pregunta Sí / No a predecir
            </label>
            <input
              id="ctx-pregunta"
              type="text"
              value={context.pregunta}
              onChange={(e) => onChange({ ...context, pregunta: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>

          <div>
            <label htmlFor="ctx-decision" className="block text-sm font-semibold text-slate-900">
              Decisión que tomará el equipo con la predicción
            </label>
            <textarea
              id="ctx-decision"
              rows={3}
              value={context.decision}
              onChange={(e) => onChange({ ...context, decision: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <div className="text-sm font-semibold text-slate-900">
              ¿Qué error cuesta más dinero o impacto?
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Esta definición guiará la elección del punto de corte y el análisis de ganancia neta.
            </p>

            <div className="mt-3 space-y-2.5">
              {[
                {
                  id: 'fn' as const,
                  title: 'Falso negativo (no detectar el caso)',
                  desc: 'El modelo dice "No" pero el evento SÍ ocurre. Dejamos pasar un cliente que se retrasa o se va.',
                },
                {
                  id: 'fp' as const,
                  title: 'Falso positivo (falsa alarma)',
                  desc: 'El modelo dice "Sí" pero el evento NO ocurre. Invertimos gestión o descuentos innecesarios.',
                },
                {
                  id: 'igual' as const,
                  title: 'Costo similar entre ambos errores',
                  desc: 'Equilibrar precisión y sensibilidad buscando el mejor balance general.',
                },
              ].map((opt) => {
                const active = context.costoMayor === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onChange({ ...context, costoMayor: opt.id })}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      active
                        ? 'border-blue-700 bg-blue-50/60'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">{opt.title}</span>
                      <span
                        className={`text-xs font-medium ${
                          active ? 'text-blue-700' : 'text-slate-400'
                        }`}
                      >
                        {active ? 'Seleccionado' : 'Elegir'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed">{opt.desc}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label htmlFor="ctx-costos-desc" className="block text-sm font-semibold text-slate-900">
              Detalle del impacto económico
            </label>
            <textarea
              id="ctx-costos-desc"
              rows={3}
              value={context.descripcionCostos}
              onChange={(e) => onChange({ ...context, descripcionCostos: e.target.value })}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 2: CARGAR DATOS, VISTA PREVIA, TIPOS (str) Y CALIDAD
   ============================================================================ */
interface Step2Props {
  datasetLabel: string;
  rows: RawRow[];
  profiles: ColumnProfile[];
  anomalies: DataAnomaly[];
  onLoadEmbedded: (id: 'cartera' | 'satisfaccion') => void;
  onUploadRows: (rows: RawRow[], fileName: string) => void;
  onClearData: () => void;
  onFixAnomaliesImpute: () => void;
  onDropAnomalyRows: () => void;
}

export const Step2DataQuality: React.FC<Step2Props> = ({
  datasetLabel,
  rows,
  profiles,
  anomalies,
  onLoadEmbedded,
  onUploadRows,
  onClearData,
  onFixAnomaliesImpute,
  onDropAnomalyRows,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    const { rows: parsed, error } = await parseUploadedDataset(file);
    if (error) {
      setUploadError(error);
    } else {
      onUploadRows(parsed, file.name);
    }
    e.target.value = '';
  };

  const colNames = profiles.map((p) => p.name);
  const previewRows = rows.slice(0, 12);

  return (
    <div className="space-y-6">
      {/* Barra de origen de datos */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-xs font-medium text-slate-500">Base activa</div>
            <div className="mt-0.5 text-base font-bold text-slate-900">
              {rows.length > 0 ? datasetLabel : 'Ninguna base cargada'}
            </div>
            <div className="mt-0.5 text-xs text-slate-500 tabular-nums">
              {formatIntCO(rows.length)} filas <span aria-hidden="true">·</span>{' '}
              {formatIntCO(profiles.length)} columnas
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => onLoadEmbedded('cartera')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>Cartera IPS (852)</span>
            </button>
            <button
              type="button"
              onClick={() => onLoadEmbedded('satisfaccion')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <FileSpreadsheet className="h-3.5 w-3.5 text-blue-700" aria-hidden="true" />
              <span>Satisfacción bancaria (12)</span>
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
            >
              <Upload className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Subir CSV / Excel</span>
            </button>
            {rows.length > 0 && (
              <button
                type="button"
                onClick={onClearData}
                className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-800 hover:bg-rose-100 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Borrar base</span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </div>
        {uploadError && (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-800">
            {uploadError}
          </div>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm font-semibold text-slate-800">No hay datos cargados actualmente</p>
          <p className="mt-1 text-xs text-slate-500">
            Carga uno de los dos casos ejemplo del taller o sube tu propio archivo CSV / XLSX para iniciar el análisis.
          </p>
        </div>
      ) : (
        <>
          {/* Vista previa */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="text-base font-bold text-slate-900">
                Vista previa de datos (primeras {previewRows.length} filas)
              </h2>
              <span className="text-xs text-slate-500 tabular-nums">
                Mostrando {previewRows.length} de {formatIntCO(rows.length)}
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="px-3 py-2 text-left font-semibold">Fila</th>
                    {colNames.map((col) => (
                      <th key={col} className="px-3 py-2 text-left font-semibold whitespace-nowrap">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono tabular-nums">
                  {previewRows.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50/80">
                      <td className="px-3 py-2 text-slate-400">{i + 1}</td>
                      {colNames.map((col) => {
                        const val = row[col];
                        const missing = isMissingValue(val);
                        return (
                          <td
                            key={col}
                            className={`px-3 py-2 whitespace-nowrap ${
                              missing ? 'bg-amber-50 text-amber-800 font-semibold' : 'text-slate-800'
                            }`}
                          >
                            {missing ? 'NA' : String(val)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Estructura de variables (str) */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-base font-bold text-slate-900 mb-1">
              Tipos de variables (equivalente a str() en R)
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Revisa cómo fueron leídas las columnas, cuántos valores únicos tienen y si presentan datos faltantes.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3 py-2 text-left font-semibold">Columna</th>
                    <th className="px-3 py-2 text-left font-semibold">Tipo R (str)</th>
                    <th className="px-3 py-2 text-right font-semibold">Válidos</th>
                    <th className="px-3 py-2 text-right font-semibold">Faltantes (NA)</th>
                    <th className="px-3 py-2 text-right font-semibold">Valores únicos</th>
                    <th className="px-3 py-2 text-left font-semibold">Primeros valores</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {profiles.map((prof) => {
                    const rType = inferRawRType(rows.map((r) => r[prof.name]));
                    const rTypeLabel =
                      rType === 'int'
                        ? 'int (entero)'
                        : rType === 'num'
                          ? 'num (decimal)'
                          : 'chr (texto)';
                    return (
                      <tr key={prof.name} className="hover:bg-slate-50/70">
                        <td className="px-3 py-2 font-semibold text-slate-900">{prof.name}</td>
                        <td className="px-3 py-2 font-mono text-slate-700">{rTypeLabel}</td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                          {formatIntCO(prof.nonMissingCount)}
                        </td>
                        <td
                          className={`px-3 py-2 text-right font-mono tabular-nums ${
                            prof.missingCount > 0 ? 'font-bold text-amber-700' : 'text-slate-500'
                          }`}
                        >
                          {formatIntCO(prof.missingCount)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                          {formatIntCO(prof.uniqueCount)}
                        </td>
                        <td className="px-3 py-2 font-mono text-slate-500 truncate max-w-xs">
                          {prof.sampleValues.join(', ')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Calidad de datos */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  Auditoría de calidad: faltantes y valores imposibles
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Reporta la fila exacta donde aparecen celdas vacías o cifras imposibles (como meses negativos).
                </p>
              </div>

              {anomalies.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={onFixAnomaliesImpute}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:bg-blue-100 whitespace-nowrap shrink-0"
                  >
                    <Wrench className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Corregir con mediana / valor absoluto</span>
                  </button>
                  <button
                    type="button"
                    onClick={onDropAnomalyRows}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    <span>Excluir filas afectadas</span>
                  </button>
                </div>
              )}
            </div>

            {anomalies.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/60 px-4 py-3 text-sm text-emerald-900">
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" aria-hidden="true" />
                <span>
                  Base limpia: no se encontraron valores faltantes ni valores negativos imposibles.
                </span>
              </div>
            ) : (
              <div className="overflow-x-auto border border-amber-200 rounded-lg">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="bg-amber-50/80 border-b border-amber-200 text-amber-950">
                      <th className="px-3 py-2 text-left font-semibold">Fila exacta</th>
                      <th className="px-3 py-2 text-left font-semibold">Columna</th>
                      <th className="px-3 py-2 text-left font-semibold">Tipo de hallazgo</th>
                      <th className="px-3 py-2 text-left font-semibold">Valor encontrado</th>
                      <th className="px-3 py-2 text-left font-semibold">Detalle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-amber-100 bg-white">
                    {anomalies.slice(0, 50).map((a) => (
                      <tr key={a.id}>
                        <td className="px-3 py-2 font-mono font-bold text-slate-900 tabular-nums">
                          Fila {a.rowNumber}
                        </td>
                        <td className="px-3 py-2 font-semibold text-slate-800">{a.column}</td>
                        <td className="px-3 py-2 font-medium text-amber-800">{a.kind}</td>
                        <td className="px-3 py-2 font-mono text-rose-700">{a.valueDisplay}</td>
                        <td className="px-3 py-2 text-slate-600">{a.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {anomalies.length > 50 && (
                  <div className="bg-amber-50 px-3 py-2 text-xs text-amber-900">
                    Mostrando las primeras 50 de {formatIntCO(anomalies.length)} anomalías detectadas.
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

/* ============================================================================
   PASO 3: VARIABLE OBJETIVO Y ADVERTENCIA CONTRA REGRESIÓN LINEAL
   ============================================================================ */
interface Step3Props {
  rows: RawRow[];
  profiles: ColumnProfile[];
  targetCol: string;
  positiveClass: string;
  onChangeTarget: (col: string) => void;
  onChangePositiveClass: (val: string) => void;
}

export const Step3Target: React.FC<Step3Props> = ({
  rows,
  profiles,
  targetCol,
  positiveClass,
  onChangeTarget,
  onChangePositiveClass,
}) => {
  const targetProfile = profiles.find((p) => p.name === targetCol);
  const candidateTargets = profiles.filter((p) => p.uniqueCount >= 2 && p.uniqueCount <= 10);

  const counts = useMemo(() => {
    let pos = 0;
    let neg = 0;
    rows.forEach((r) => {
      const v = r[targetCol];
      if (isMissingValue(v)) return;
      if (String(v).trim() === positiveClass) pos++;
      else neg++;
    });
    return { pos, neg, total: pos + neg };
  }, [rows, targetCol, positiveClass]);

  // Calcular demostración real de regresión lineal sobre Y (0/1)
  const linearDemo = useMemo(() => {
    if (!targetCol || rows.length < 4) return null;
    const numCols = profiles.filter(
      (p) => p.name !== targetCol && p.inferredType === 'numeric'
    );
    if (numCols.length === 0) return null;

    const X: number[][] = [];
    const y: number[] = [];
    rows.forEach((r) => {
      const tv = r[targetCol];
      if (isMissingValue(tv)) return;
      const vec: number[] = [];
      for (const c of numCols) {
        const n = toNumericValue(r[c.name]);
        if (n === null) return;
        vec.push(n);
      }
      X.push(vec);
      y.push(String(tv).trim() === positiveClass ? 1 : 0);
    });

    if (X.length < 4) return null;
    return computeLinearRegressionWarningMetrics(X, y);
  }, [rows, profiles, targetCol, positiveClass]);

  return (
    <div className="space-y-6">
      <div className="grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <label htmlFor="select-target" className="block text-sm font-semibold text-slate-900">
              Selecciona la variable objetivo (Y)
            </label>
            <p className="text-xs text-slate-500 mt-0.5">
              Debe representar el resultado binario Sí / No que queremos predecir.
            </p>
            <select
              id="select-target"
              value={targetCol}
              onChange={(e) => onChangeTarget(e.target.value)}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
            >
              {(candidateTargets.length > 0 ? candidateTargets : profiles).map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.uniqueCount} valores únicos)
                </option>
              ))}
            </select>
          </div>

          {targetProfile && (
            <div>
              <label
                htmlFor="select-positive"
                className="block text-sm font-semibold text-slate-900"
              >
                Clase positiva (valor que equivale a 1 = "Sí ocurre el evento")
              </label>
              <p className="text-xs text-slate-500 mt-0.5">
                Los demás valores quedarán agrupados como clase 0 ("No ocurre").
              </p>
              <select
                id="select-positive"
                value={positiveClass}
                onChange={(e) => onChangePositiveClass(e.target.value)}
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 focus:border-blue-700 focus:outline-none"
              >
                {targetProfile.uniqueValues.map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
            <div className="font-semibold text-slate-900 mb-1.5">
              Conversión a factor binario (0 / 1)
            </div>
            <div className="flex items-center justify-between py-1 border-b border-slate-200/80">
              <span>Clase 1 (Positiva: "{positiveClass}")</span>
              <span className="font-mono font-bold text-blue-800 tabular-nums">
                {formatIntCO(counts.pos)} casos ({formatPercentCO(counts.total ? counts.pos / counts.total : 0, 1)})
              </span>
            </div>
            <div className="flex items-center justify-between py-1">
              <span>Clase 0 (Negativa: resto)</span>
              <span className="font-mono font-semibold text-slate-800 tabular-nums">
                {formatIntCO(counts.neg)} casos ({formatPercentCO(counts.total ? counts.neg / counts.total : 0, 1)})
              </span>
            </div>
          </div>
        </div>

        {/* Advertencia obligatoria sobre Regresión Lineal */}
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 space-y-3">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <h2 className="text-base font-bold text-slate-900">
                ¿Por qué NO usar Regresión Lineal con una Y de 0 y 1?
              </h2>
              <p className="mt-1 text-sm text-slate-700 leading-relaxed">
                La regresión lineal intenta trazar una línea recta infinita sobre puntos que solo valen 0 o 1. Eso produce un R² sin sentido práctico (muy bajo o incluso negativo fuera de muestra) y predicciones imposibles por debajo de 0% o por encima de 100%.
              </p>
            </div>
          </div>

          {linearDemo && (
            <div className="rounded-lg border border-amber-200 bg-white p-3.5 text-xs space-y-1.5">
              <div className="font-semibold text-slate-900">
                Prueba empírica sobre tus datos actuales (usando lm() lineal):
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1 font-mono tabular-nums">
                <div>
                  <div className="text-[11px] font-sans text-slate-500">R² lineal</div>
                  <div className="font-bold text-amber-800">
                    {formatNumberCO(linearDemo.rSquared, 3)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Predicción mín / máx</div>
                  <div className="font-bold text-rose-700">
                    {formatNumberCO(linearDemo.minPred, 2)} / {formatNumberCO(linearDemo.maxPred, 2)}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-sans text-slate-500">Fuera de [0, 1]</div>
                  <div className="font-bold text-rose-700">
                    {formatIntCO(linearDemo.outOfBoundsCount)} filas
                  </div>
                </div>
              </div>
            </div>
          )}

          <p className="text-xs text-slate-600 leading-relaxed">
            La regresión logística resuelve esto transformando la recta en una curva S acotada estrictamente entre 0 y 1 (probabilidades válidas).
          </p>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
   PASO 4: DESCRIPTIVO Y COMPARACIÓN ENTRE GRUPO 0 Y GRUPO 1
   ============================================================================ */
interface Step4Props {
  rows: RawRow[];
  profiles: ColumnProfile[];
  targetCol: string;
  positiveClass: string;
  groupComparison: GroupComparisonRow[];
}

export const Step4Descriptive: React.FC<Step4Props> = ({
  rows,
  profiles,
  targetCol,
  positiveClass,
  groupComparison,
}) => {
  const numericProfiles = profiles.filter(
    (p) => p.name !== targetCol && p.userType === 'numeric' && p.mean !== undefined
  );
  const categoricalProfiles = profiles.filter(
    (p) => p.name === targetCol || p.userType === 'categorical'
  );

  // Preparar datos normalizados relativos para comparar medias de grupo 0 vs grupo 1 visualmente
  const chartData = groupComparison.slice(0, 8).map((g) => ({
    variable: g.column.length > 16 ? `${g.column.slice(0, 15)}…` : g.column,
    fullName: g.column,
    grupo0: Number(g.mean0.toFixed(2)),
    grupo1: Number(g.mean1.toFixed(2)),
  }));

  return (
    <div className="space-y-6">
      {/* Variables numéricas */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Estadísticas de variables numéricas
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Resumen de tendencia central y dispersión. No incluye códigos categóricos ni la variable Y.
        </p>
        {numericProfiles.length === 0 ? (
          <p className="text-xs text-slate-500">No hay variables numéricas predictoras.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="px-3 py-2 text-left font-semibold">Variable</th>
                  <th className="px-3 py-2 text-right font-semibold">n</th>
                  <th className="px-3 py-2 text-right font-semibold">Promedio</th>
                  <th className="px-3 py-2 text-right font-semibold">Desv. estándar</th>
                  <th className="px-3 py-2 text-right font-semibold">Mínimo</th>
                  <th className="px-3 py-2 text-right font-semibold">Mediana</th>
                  <th className="px-3 py-2 text-right font-semibold">Máximo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {numericProfiles.map((p) => (
                  <tr key={p.name} className="hover:bg-slate-50/70">
                    <td className="px-3 py-2 font-semibold text-slate-900">{p.name}</td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                      {formatIntCO(p.nonMissingCount)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatFlexibleCO(p.mean ?? NaN, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                      {formatFlexibleCO(p.sd ?? NaN, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                      {formatFlexibleCO(p.min ?? NaN, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                      {formatFlexibleCO(p.median ?? NaN, 2)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600">
                      {formatFlexibleCO(p.max ?? NaN, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Conteos para categóricas y para Y */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Conteos para variables categóricas y variable objetivo ({targetCol})
        </h2>
        <p className="text-xs text-slate-500 mb-3">
          Las variables categóricas y la Y de 0/1 se resumen mediante frecuencias absolutas y porcentajes, nunca con promedios.
        </p>

        <div className="grid gap-4 md:grid-cols-2">
          {categoricalProfiles.map((prof) => {
            const countMap = new Map<string, number>();
            let validTotal = 0;
            rows.forEach((r) => {
              const v = r[prof.name];
              if (isMissingValue(v)) return;
              const key = String(v).trim();
              countMap.set(key, (countMap.get(key) ?? 0) + 1);
              validTotal++;
            });

            return (
              <div
                key={prof.name}
                className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-900">
                    {prof.name}
                    {prof.name === targetCol ? ' (Objetivo Y)' : ''}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums">
                    {prof.uniqueCount} categorías
                  </span>
                </div>
                <div className="space-y-1.5">
                  {Array.from(countMap.entries()).map(([lvl, cnt]) => {
                    const pct = validTotal > 0 ? cnt / validTotal : 0;
                    const isPosTarget = prof.name === targetCol && lvl === positiveClass;
                    return (
                      <div key={lvl} className="text-xs">
                        <div className="flex justify-between text-slate-700 mb-0.5">
                          <span className={isPosTarget ? 'font-bold text-blue-800' : 'font-medium'}>
                            {lvl}
                            {isPosTarget ? ' (Clase 1)' : ''}
                          </span>
                          <span className="font-mono tabular-nums">
                            {formatIntCO(cnt)} ({formatPercentCO(pct, 1)})
                          </span>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isPosTarget ? 'bg-blue-700' : 'bg-slate-500'
                            }`}
                            style={{ width: `${Math.min(100, pct * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comparación Grupo 0 vs Grupo 1 */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-bold text-slate-900 mb-1">
          Comparación de promedios: Grupo 0 vs. Grupo 1 ({positiveClass})
        </h2>
        <p className="text-xs text-slate-500 mb-4">
          Permite ver qué variables tienen promedios visiblemente distintos entre quienes presentan el evento y quienes no.
        </p>

        {groupComparison.length > 0 && (
          <>
            <div className="overflow-x-auto mb-5">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                    <th className="px-3 py-2 text-left font-semibold">Variable</th>
                    <th className="px-3 py-2 text-right font-semibold">Promedio Grupo 0</th>
                    <th className="px-3 py-2 text-right font-semibold">Promedio Grupo 1</th>
                    <th className="px-3 py-2 text-right font-semibold">Diferencia (1 − 0)</th>
                    <th className="px-3 py-2 text-right font-semibold">p-value (Welch)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {groupComparison.map((row) => (
                    <tr key={row.column} className="hover:bg-slate-50/70">
                      <td className="px-3 py-2 font-semibold text-slate-900">{row.column}</td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-700">
                        {formatFlexibleCO(row.mean0, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums font-semibold text-blue-900">
                        {formatFlexibleCO(row.mean1, 2)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-800">
                        {row.diff >= 0 ? '+' : ''}
                        {formatFlexibleCO(row.diff, 2)}
                      </td>
                      <td
                        className={`px-3 py-2 text-right font-mono tabular-nums ${
                          row.pValue < 0.05 ? 'font-bold text-emerald-700' : 'text-slate-500'
                        }`}
                      >
                        {formatPValueCO(row.pValue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {chartData.length > 0 && (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 4, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="variable" tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} />
                    <Tooltip
                      formatter={(value: unknown) => formatFlexibleCO(Number(value), 2)}
                      labelFormatter={(_label, items) =>
                        items?.[0]?.payload?.fullName ?? String(_label)
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="grupo0" name="Promedio Grupo 0" fill="#94A3B8" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="grupo1" name="Promedio Grupo 1" fill="#1D4ED8" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
