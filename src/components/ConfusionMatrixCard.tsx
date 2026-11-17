import React from 'react';
import { ConfusionEvaluation } from '../types/model';
import { formatIntCO, formatPercentCO } from '../utils/formatters';

interface ConfusionMatrixCardProps {
  title: string;
  subtitle: string;
  evaluation: ConfusionEvaluation;
  positiveLabel: string;
  negativeLabel: string;
}

export const ConfusionMatrixCard: React.FC<ConfusionMatrixCardProps> = ({
  title,
  subtitle,
  evaluation,
  positiveLabel,
  negativeLabel,
}) => {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
        <h3 className="text-base font-bold text-slate-900">{title}</h3>
        <span className="text-xs text-slate-500 tabular-nums">{subtitle}</span>
      </div>

      <div className="mb-3 text-xs font-medium text-slate-600">
        Filas = Valor real <span aria-hidden="true">·</span> Columnas = Predicción del modelo
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
              <th className="p-2.5 text-left font-semibold">Real \ Predicción</th>
              <th className="p-2.5 text-right font-semibold">Pred: 0 ({negativeLabel})</th>
              <th className="p-2.5 text-right font-semibold">Pred: 1 ({positiveLabel})</th>
              <th className="p-2.5 text-right font-semibold">Total / % nivel</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-slate-200">
              <td className="p-2.5 font-semibold text-slate-800 bg-slate-50/50">
                Real: 0 ({negativeLabel})
              </td>
              <td className="p-2.5 text-right bg-emerald-50 text-emerald-950 font-mono tabular-nums border border-emerald-200/70">
                <div className="text-sm font-bold">{formatIntCO(evaluation.tn)}</div>
                <div className="text-[11px] text-emerald-800">Acierto (VN)</div>
              </td>
              <td className="p-2.5 text-right bg-rose-50/70 text-rose-950 font-mono tabular-nums border border-rose-200/70">
                <div className="text-sm font-bold">{formatIntCO(evaluation.fp)}</div>
                <div className="text-[11px] text-rose-800">Falsa alarma (FP)</div>
              </td>
              <td className="p-2.5 text-right font-mono tabular-nums text-slate-700 bg-slate-50/40">
                <div className="font-semibold">{formatIntCO(evaluation.tn + evaluation.fp)}</div>
                <div className="text-[11px] text-slate-500">
                  {formatPercentCO(evaluation.row0Pct, 1)}
                </div>
              </td>
            </tr>
            <tr>
              <td className="p-2.5 font-semibold text-slate-800 bg-slate-50/50">
                Real: 1 ({positiveLabel})
              </td>
              <td className="p-2.5 text-right bg-amber-50/80 text-amber-950 font-mono tabular-nums border border-amber-200/70">
                <div className="text-sm font-bold">{formatIntCO(evaluation.fn)}</div>
                <div className="text-[11px] text-amber-800">No detectado (FN)</div>
              </td>
              <td className="p-2.5 text-right bg-emerald-50 text-emerald-950 font-mono tabular-nums border border-emerald-200/70">
                <div className="text-sm font-bold">{formatIntCO(evaluation.tp)}</div>
                <div className="text-[11px] text-emerald-800">Acierto (VP)</div>
              </td>
              <td className="p-2.5 text-right font-mono tabular-nums text-slate-700 bg-slate-50/40">
                <div className="font-semibold">{formatIntCO(evaluation.fn + evaluation.tp)}</div>
                <div className="text-[11px] text-slate-500">
                  {formatPercentCO(evaluation.row1Pct, 1)}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Métricas globales */}
      <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3 text-center">
        <div>
          <div className="text-[11px] text-slate-500">Accuracy</div>
          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
            {formatPercentCO(evaluation.accuracy, 1)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Tasa de error</div>
          <div className="font-mono text-sm font-bold text-slate-900 tabular-nums">
            {formatPercentCO(evaluation.errorRate, 1)}
          </div>
        </div>
        <div>
          <div className="text-[11px] text-slate-500">Accuracy balanceada</div>
          <div className="font-mono text-sm font-bold text-blue-800 tabular-nums">
            {formatPercentCO(evaluation.balancedAccuracy, 1)}
          </div>
        </div>
      </div>

      {/* Métricas por clase */}
      <div className="mt-3 overflow-x-auto border-t border-slate-200 pt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-slate-500 border-b border-slate-100">
              <th className="py-1.5 text-left font-medium">Clase</th>
              <th className="py-1.5 text-right font-medium">Precisión</th>
              <th className="py-1.5 text-right font-medium">Recall (Sens.)</th>
              <th className="py-1.5 text-right font-medium">F1-Score</th>
              <th className="py-1.5 text-right font-medium">Especificidad</th>
            </tr>
          </thead>
          <tbody className="font-mono tabular-nums">
            <tr className="border-b border-slate-100 text-slate-800">
              <td className="py-1.5 font-sans font-semibold text-blue-900">
                Clase 1 ({positiveLabel})
              </td>
              <td className="py-1.5 text-right">{formatPercentCO(evaluation.class1.precision, 1)}</td>
              <td className="py-1.5 text-right">{formatPercentCO(evaluation.class1.recall, 1)}</td>
              <td className="py-1.5 text-right font-bold text-blue-800">
                {formatPercentCO(evaluation.class1.f1, 1)}
              </td>
              <td className="py-1.5 text-right">
                {formatPercentCO(evaluation.class1.specificity, 1)}
              </td>
            </tr>
            <tr className="text-slate-600">
              <td className="py-1.5 font-sans font-medium">Clase 0 ({negativeLabel})</td>
              <td className="py-1.5 text-right">{formatPercentCO(evaluation.class0.precision, 1)}</td>
              <td className="py-1.5 text-right">{formatPercentCO(evaluation.class0.recall, 1)}</td>
              <td className="py-1.5 text-right">{formatPercentCO(evaluation.class0.f1, 1)}</td>
              <td className="py-1.5 text-right">
                {formatPercentCO(evaluation.class0.specificity, 1)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
