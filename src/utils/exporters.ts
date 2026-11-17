import {
  BusinessContext,
  ConfusionEvaluation,
  LogisticModelResult,
  ProfitConfig,
  ProfitCurvePoint,
  RawRow,
  RiskPolicy,
} from '../types/model';
import { formatCurrencyCO, formatNumberCO, formatPercentCO, formatPValueCO } from './formatters';
import { RCodeContext, generateRCodeForStep } from './rCodeGenerator';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function triggerDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob(['\uFEFF' + content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface ScoredExportRow {
  originalIndex: number;
  row: RawRow;
  partition: 'Entrenamiento' | 'Prueba';
  probability: number;
  predictedClass: number;
  riskLevel: 'Bajo' | 'Medio' | 'Alto';
}

export function buildScoredCsv(scoredRows: ScoredExportRow[]): string {
  if (scoredRows.length === 0) return '';
  const baseHeaders = Object.keys(scoredRows[0].row);
  const headers = [...baseHeaders, 'particion', 'probabilidad', 'clase_predicha', 'nivel_riesgo'];

  const escapeCsv = (val: unknown) => {
    const s = val === null || val === undefined ? '' : String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = [
    headers.join(','),
    ...scoredRows.map((item) => {
      const baseVals = baseHeaders.map((h) => escapeCsv(item.row[h]));
      return [
        ...baseVals,
        escapeCsv(item.partition),
        item.probability.toFixed(6),
        String(item.predictedClass),
        escapeCsv(item.riskLevel),
      ].join(',');
    }),
  ];
  return lines.join('\n');
}

export interface HtmlReportPayload {
  datasetLabel: string;
  totalRows: number;
  modeledRows: number;
  targetCol: string;
  positiveClass: string;
  context: BusinessContext;
  model: LogisticModelResult;
  trainEval: ConfusionEvaluation;
  testEval: ConfusionEvaluation;
  aucTest: number;
  threshold: number;
  profitConfig: ProfitConfig;
  bestProfitPoint: ProfitCurvePoint;
  riskPolicy: RiskPolicy;
  riskCounts: { low: number; medium: number; high: number };
  rContext: RCodeContext;
}

export function buildHtmlReport(payload: HtmlReportPayload): string {
  const fullRScript = Array.from({ length: 16 }, (_, idx) =>
    generateRCodeForStep(idx + 1, payload.rContext)
  ).join('\n\n');

  const coefRows = payload.model.coefficients
    .map(
      (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td class="num">${formatNumberCO(c.estimate, 4)}</td>
        <td class="num">${formatNumberCO(c.stdError, 4)}</td>
        <td class="num">${formatNumberCO(c.zValue, 3)}</td>
        <td class="num ${c.pValue < 0.05 ? 'sig' : ''}">${formatPValueCO(c.pValue)}</td>
        <td class="num">${c.isIntercept ? '—' : formatNumberCO(c.oddsRatio, 3)}</td>
      </tr>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Informe Ejecutivo - Predictor de Riesgo con Regresión Logística</title>
  <style>
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #0f172a; margin: 36px auto; max-width: 980px; line-height: 1.55; padding: 0 20px; }
    h1 { font-size: 24px; margin-bottom: 6px; border-bottom: 2px solid #1d4ed8; padding-bottom: 10px; }
    h2 { font-size: 18px; margin-top: 28px; color: #1e293b; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .meta { color: #475569; font-size: 13px; margin-bottom: 24px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin: 16px 0; }
    .kpi { border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px 14px; background: #f8fafc; }
    .kpi-label { font-size: 12px; color: #475569; }
    .kpi-val { font-size: 20px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
    table { width: 100%; border-collapse: collapse; margin: 14px 0; font-size: 13px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; text-align: left; }
    th { background: #f1f5f9; font-weight: 600; }
    td.num { text-align: right; font-variant-numeric: tabular-nums; font-family: Consolas, monospace; }
    td.sig { color: #15803d; font-weight: 700; background: #f0fdf4; }
    pre { background: #0f172a; color: #e2e8f0; padding: 16px; border-radius: 6px; overflow-x: auto; font-size: 12px; line-height: 1.5; }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: 14px; background: #f8fafc; margin: 12px 0; }
  </style>
</head>
<body>
  <h1>Informe CRISP-DM: Predictor de Riesgo con Regresión Logística</h1>
  <div class="meta">
    Base analizada: <strong>${escapeHtml(payload.datasetLabel)}</strong> · Registros totales: ${payload.totalRows} · Registros modelados: ${payload.modeledRows} · Variable objetivo: <strong>${escapeHtml(payload.targetCol)}</strong> (Clase positiva = ${escapeHtml(payload.positiveClass)}) · Generado el ${new Date().toLocaleDateString('es-CO')}
  </div>

  <h2>1. Comprensión del negocio</h2>
  <div class="box">
    <p><strong>Pregunta de negocio:</strong> ${escapeHtml(payload.context.pregunta)}</p>
    <p><strong>Contexto:</strong> ${escapeHtml(payload.context.contextoIndustria)}</p>
    <p><strong>Decisión a tomar:</strong> ${escapeHtml(payload.context.decision)}</p>
    <p><strong>Error más costoso:</strong> ${
      payload.context.costoMayor === 'fn'
        ? 'Falso negativo (no detectar el caso de riesgo)'
        : payload.context.costoMayor === 'fp'
          ? 'Falso positivo (falsa alarma)'
          : 'Similar entre ambos errores'
    }. ${escapeHtml(payload.context.descripcionCostos)}</p>
  </div>

  <h2>2. Resumen de métricas en Prueba (Corte = ${formatNumberCO(payload.threshold, 2)})</h2>
  <div class="grid">
    <div class="kpi"><div class="kpi-label">Accuracy (Prueba)</div><div class="kpi-val">${formatPercentCO(payload.testEval.accuracy)}</div></div>
    <div class="kpi"><div class="kpi-label">F1 Clase Positiva (Prueba)</div><div class="kpi-val">${formatPercentCO(payload.testEval.class1.f1)}</div></div>
    <div class="kpi"><div class="kpi-label">Recall / Sensibilidad (Prueba)</div><div class="kpi-val">${formatPercentCO(payload.testEval.class1.recall)}</div></div>
    <div class="kpi"><div class="kpi-label">AUC ROC (Prueba)</div><div class="kpi-val">${formatNumberCO(payload.aucTest, 3)}</div></div>
    <div class="kpi"><div class="kpi-label">AIC del Modelo</div><div class="kpi-val">${formatNumberCO(payload.model.aic, 1)}</div></div>
  </div>

  <h2>3. Coeficientes del modelo logístico (Máxima Verosimilitud)</h2>
  <table>
    <thead>
      <tr>
        <th>Variable</th>
        <th>Estimación (b)</th>
        <th>Error estándar</th>
        <th>Estadístico z</th>
        <th>p-value</th>
        <th>Odds Ratio (e^b)</th>
      </tr>
    </thead>
    <tbody>${coefRows}</tbody>
  </table>

  <h2>4. Matrices de confusión (Filas = Real · Columnas = Predicción)</h2>
  <div class="grid">
    <div>
      <strong>Entrenamiento (n = ${payload.trainEval.total})</strong>
      <table>
        <thead><tr><th>Real \\ Predicción</th><th>Pred: 0</th><th>Pred: 1</th></tr></thead>
        <tbody>
          <tr><td><strong>Real: 0</strong></td><td class="num sig">${payload.trainEval.tn} (VN)</td><td class="num">${payload.trainEval.fp} (FP)</td></tr>
          <tr><td><strong>Real: 1</strong></td><td class="num">${payload.trainEval.fn} (FN)</td><td class="num sig">${payload.trainEval.tp} (VP)</td></tr>
        </tbody>
      </table>
    </div>
    <div>
      <strong>Prueba (n = ${payload.testEval.total})</strong>
      <table>
        <thead><tr><th>Real \\ Predicción</th><th>Pred: 0</th><th>Pred: 1</th></tr></thead>
        <tbody>
          <tr><td><strong>Real: 0</strong></td><td class="num sig">${payload.testEval.tn} (VN)</td><td class="num">${payload.testEval.fp} (FP)</td></tr>
          <tr><td><strong>Real: 1</strong></td><td class="num">${payload.testEval.fn} (FN)</td><td class="num sig">${payload.testEval.tp} (VP)</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <h2>5. Ganancia neta y segmentación de acciones</h2>
  <div class="box">
    <p><strong>Punto de corte financiero óptimo (en prueba):</strong> ${formatNumberCO(payload.bestProfitPoint.threshold, 2)} con ganancia estimada de <strong>${formatCurrencyCO(payload.bestProfitPoint.profit)}</strong>.</p>
    <p><strong>Distribución de riesgo en la cartera puntuada:</strong></p>
    <ul>
      <li><strong>Riesgo Bajo (&lt; ${formatPercentCO(payload.riskPolicy.lowMax, 0)}):</strong> ${payload.riskCounts.low} casos — Acción: ${escapeHtml(payload.riskPolicy.actionLow)}</li>
      <li><strong>Riesgo Medio (${formatPercentCO(payload.riskPolicy.lowMax, 0)} – ${formatPercentCO(payload.riskPolicy.highMin, 0)}):</strong> ${payload.riskCounts.medium} casos — Acción: ${escapeHtml(payload.riskPolicy.actionMedium)}</li>
      <li><strong>Riesgo Alto (≥ ${formatPercentCO(payload.riskPolicy.highMin, 0)}):</strong> ${payload.riskCounts.high} casos — Acción: ${escapeHtml(payload.riskPolicy.actionHigh)}</li>
    </ul>
  </div>

  <h2>6. Código R equivalente (Pipeline completo)</h2>
  <pre>${escapeHtml(fullRScript)}</pre>
</body>
</html>`;
}
