import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Code2,
  Copy,
  Check,
  HelpCircle,
  Lightbulb,
} from 'lucide-react';
import { StepGuideContent } from '../types/model';

interface StepHeaderProps {
  guide: StepGuideContent;
}

export const StepHeader: React.FC<StepHeaderProps> = ({ guide }) => {
  const [showHelp, setShowHelp] = useState(false);

  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-slate-500">
            <span>{guide.phase}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="tabular-nums">Paso {guide.stepNumber} de 16</span>
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 [text-wrap:balance]">
            Paso {guide.stepNumber} – {guide.title}
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowHelp((prev) => !prev)}
          aria-expanded={showHelp}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 whitespace-nowrap shrink-0"
        >
          <HelpCircle className="h-4 w-4 text-blue-700" aria-hidden="true" />
          <span>¿Qué significa?</span>
        </button>
      </div>

      {showHelp && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4 text-sm text-slate-700">
          <div className="font-semibold text-slate-900">{guide.whatItMeansTitle}</div>
          <p className="mt-1.5 leading-relaxed">{guide.whatItMeansBody}</p>
          <div className="mt-2.5 rounded-lg border border-blue-200/80 bg-white/80 px-3.5 py-2.5 text-xs text-slate-700">
            <span className="font-semibold text-blue-900">Ejemplo práctico: </span>
            {guide.whatItMeansExample}
          </div>
        </div>
      )}
    </div>
  );
};

interface KeyFindingBoxProps {
  finding: string;
  tone?: 'neutral' | 'good' | 'warning';
}

export const KeyFindingBox: React.FC<KeyFindingBoxProps> = ({ finding, tone = 'neutral' }) => {
  const toneClasses =
    tone === 'warning'
      ? 'border-amber-200 bg-amber-50/60'
      : tone === 'good'
        ? 'border-emerald-200 bg-emerald-50/60'
        : 'border-slate-200 bg-slate-100/70';

  const iconClasses =
    tone === 'warning'
      ? 'text-amber-700'
      : tone === 'good'
        ? 'text-emerald-700'
        : 'text-blue-700';

  return (
    <section
      aria-label="Hallazgo clave"
      className={`mb-6 rounded-xl border p-4 ${toneClasses}`}
    >
      <div className="flex items-start gap-3">
        <Lightbulb className={`mt-0.5 h-4 w-4 shrink-0 ${iconClasses}`} aria-hidden="true" />
        <div className="min-w-0 text-sm text-slate-800 leading-relaxed">
          <span className="font-semibold text-slate-900">Hallazgo clave: </span>
          <span>{finding}</span>
        </div>
      </div>
    </section>
  );
};

interface RCodeCollapsibleProps {
  code: string;
}

export const RCodeCollapsible: React.FC<RCodeCollapsibleProps> = ({ code }) => {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Silencioso si el portapapeles no está disponible
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="flex flex-1 items-center gap-2 text-left text-sm font-semibold text-slate-800 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
        >
          <Code2 className="h-4 w-4 text-slate-500 shrink-0" aria-hidden="true" />
          <span>Código R equivalente</span>
          {open ? (
            <ChevronUp className="ml-1 h-4 w-4 text-slate-500" aria-hidden="true" />
          ) : (
            <ChevronDown className="ml-1 h-4 w-4 text-slate-500" aria-hidden="true" />
          )}
        </button>

        {open && (
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap shrink-0"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
                <span>Copiado</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                <span>Copiar</span>
              </>
            )}
          </button>
        )}
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-slate-900 p-4 rounded-b-xl overflow-x-auto">
          <pre className="font-mono text-xs leading-relaxed text-slate-100 whitespace-pre">
            <code>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

interface StepFooterNavProps {
  currentStep: number;
  totalSteps: number;
  onPrev: () => void;
  onNext: () => void;
  canNext?: boolean;
}

export const StepFooterNav: React.FC<StepFooterNavProps> = ({
  currentStep,
  totalSteps,
  onPrev,
  onNext,
  canNext = true,
}) => {
  return (
    <div className="mt-8 flex items-center justify-between border-t border-slate-200 pt-5">
      <button
        type="button"
        onClick={onPrev}
        disabled={currentStep <= 1}
        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        <span>Anterior</span>
      </button>

      <div className="text-xs font-medium text-slate-500 tabular-nums">
        Paso {currentStep} de {totalSteps}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={currentStep >= totalSteps || !canNext}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap shrink-0"
      >
        <span>{currentStep >= totalSteps ? 'Finalizado' : 'Siguiente'}</span>
        {currentStep < totalSteps && <ChevronRight className="h-4 w-4" aria-hidden="true" />}
      </button>
    </div>
  );
};
