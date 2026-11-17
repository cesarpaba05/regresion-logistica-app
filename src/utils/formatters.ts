export function formatNumberCO(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatFlexibleCO(value: number, maxDecimals = 4): string {
  if (!Number.isFinite(value)) return '—';
  if (Math.abs(value) > 0 && Math.abs(value) < 0.0001) {
    return value.toExponential(2).replace('.', ',');
  }
  return new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals,
  }).format(value);
}

export function formatIntCO(value: number): string {
  if (!Number.isFinite(value)) return '—';
  return new Intl.NumberFormat('es-CO', {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatPercentCO(ratio: number, decimals = 1): string {
  if (!Number.isFinite(ratio)) return '—';
  return `${formatNumberCO(ratio * 100, decimals)}%`;
}

export function formatCurrencyCO(value: number, decimals = 0): string {
  if (!Number.isFinite(value)) return '—';
  const sign = value < 0 ? '-' : '';
  const formatted = formatNumberCO(Math.abs(value), decimals);
  return `${sign}$ ${formatted}`;
}

export function formatPValueCO(p: number): string {
  if (!Number.isFinite(p)) return '—';
  if (p < 0.0001) return '< 0,0001';
  return formatNumberCO(p, 4);
}
