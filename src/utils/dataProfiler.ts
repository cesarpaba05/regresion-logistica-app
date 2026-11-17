import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { jStat } from 'jstat';
import { ColumnProfile, DataAnomaly, RawRow, RawValue, VariableRoleType } from '../types/model';

export function isMissingValue(val: RawValue): boolean {
  if (val === null || val === undefined) return true;
  if (typeof val === 'number') return Number.isNaN(val);
  const s = String(val).trim();
  return s === '' || s.toUpperCase() === 'NA' || s.toUpperCase() === 'NAN' || s.toUpperCase() === 'NULL';
}

export function toNumericValue(val: RawValue): number | null {
  if (isMissingValue(val)) return null;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (typeof val === 'boolean') return val ? 1 : 0;
  let s = String(val).trim();
  // Soportar formato con coma decimal si no hay punto
  if (s.includes(',') && !s.includes('.')) {
    s = s.replace(',', '.');
  }
  const parsed = Number(s);
  return Number.isFinite(parsed) ? parsed : null;
}

export function inferRawRType(values: RawValue[]): 'num' | 'int' | 'chr' {
  const nonMissing = values.filter((v) => !isMissingValue(v));
  if (nonMissing.length === 0) return 'chr';
  const nums = nonMissing.map(toNumericValue);
  if (nums.some((n) => n === null)) return 'chr';
  const allInts = nums.every((n) => n !== null && Number.isInteger(n));
  return allInts ? 'int' : 'num';
}

export function shouldRecommendCategorical(colName: string, values: RawValue[]): boolean {
  const lower = colName.toLowerCase();
  const nonMissing = values.filter((v) => !isMissingValue(v));
  if (nonMissing.length === 0) return true;
  const nums = nonMissing.map(toNumericValue);
  if (nums.some((n) => n === null)) return true; // texto
  const unique = new Set(nonMissing.map((v) => String(v).trim()));
  if (
    (lower.includes('tipo') ||
      lower.includes('categ') ||
      lower.includes('estrato') ||
      lower.includes('nivel') ||
      lower.includes('sector') ||
      lower.includes('zona') ||
      lower.includes('grupo')) &&
    unique.size >= 2 &&
    unique.size <= 15
  ) {
    return true;
  }
  return false;
}

function quantileSorted(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN;
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  }
  return sorted[base];
}

export function profileDataset(
  rows: RawRow[],
  userTypesOverride: Record<string, VariableRoleType> = {}
): ColumnProfile[] {
  if (rows.length === 0) return [];
  const colNames = Object.keys(rows[0]);

  return colNames.map((name) => {
    const rawVals = rows.map((r) => r[name]);
    const nonMissing = rawVals.filter((v) => !isMissingValue(v));
    const missingCount = rows.length - nonMissing.length;
    const strValues = nonMissing.map((v) => String(v).trim());
    const uniqueValues = Array.from(new Set(strValues)).sort((a, b) => {
      const na = Number(a);
      const nb = Number(b);
      if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
      return a.localeCompare(b, 'es');
    });

    const rawType = inferRawRType(rawVals);
    const inferredType: VariableRoleType = rawType === 'chr' ? 'categorical' : 'numeric';
    const recommendedCat = shouldRecommendCategorical(name, rawVals);
    const userType: VariableRoleType =
      userTypesOverride[name] ?? (recommendedCat ? 'categorical' : inferredType);

    const nums = nonMissing
      .map(toNumericValue)
      .filter((n): n is number => n !== null)
      .sort((a, b) => a - b);

    let mean: number | undefined;
    let sd: number | undefined;
    let median: number | undefined;
    let min: number | undefined;
    let max: number | undefined;
    let q25: number | undefined;
    let q75: number | undefined;

    if (nums.length > 0 && rawType !== 'chr') {
      const sum = nums.reduce((acc, v) => acc + v, 0);
      mean = sum / nums.length;
      const variance =
        nums.length > 1
          ? nums.reduce((acc, v) => acc + (v - mean!) ** 2, 0) / (nums.length - 1)
          : 0;
      sd = Math.sqrt(variance);
      min = nums[0];
      max = nums[nums.length - 1];
      median = quantileSorted(nums, 0.5);
      q25 = quantileSorted(nums, 0.25);
      q75 = quantileSorted(nums, 0.75);
    }

    return {
      name,
      inferredType,
      userType,
      nonMissingCount: nonMissing.length,
      missingCount,
      uniqueCount: uniqueValues.length,
      uniqueValues,
      sampleValues: strValues.slice(0, 5),
      mean,
      sd,
      median,
      min,
      max,
      q25,
      q75,
    };
  });
}

const NON_NEGATIVE_KEYWORDS = [
  'mes',
  'meses',
  'edad',
  'agno',
  'ano',
  'año',
  'venta',
  'cartera',
  'pasivo',
  'ingreso',
  'precio',
  'monto',
  'tiempo',
  'antiguedad',
  'cantidad',
  'dia',
];

export function detectDataAnomalies(rows: RawRow[], profiles: ColumnProfile[]): DataAnomaly[] {
  const anomalies: DataAnomaly[] = [];
  const profileMap = new Map(profiles.map((p) => [p.name, p]));

  rows.forEach((row, idx) => {
    const rowNumber = idx + 1;
    Object.keys(row).forEach((col) => {
      const val = row[col];
      if (isMissingValue(val)) {
        anomalies.push({
          id: `miss-${rowNumber}-${col}`,
          rowIndex: idx,
          rowNumber,
          column: col,
          valueDisplay: 'Vacío / NA',
          kind: 'Faltante',
          detail: `Valor faltante en "${col}" (fila ${rowNumber}).`,
        });
        return;
      }

      const prof = profileMap.get(col);
      if (prof && prof.inferredType === 'numeric') {
        const num = toNumericValue(val);
        if (num !== null) {
          const lower = col.toLowerCase();
          const mustBeNonNegative = NON_NEGATIVE_KEYWORDS.some((kw) => lower.includes(kw));
          if (mustBeNonNegative && num < 0) {
            anomalies.push({
              id: `imp-${rowNumber}-${col}`,
              rowIndex: idx,
              rowNumber,
              column: col,
              valueDisplay: String(num),
              kind: 'Valor imposible',
              detail: `"${col}" no puede ser negativo (${num}) en la fila ${rowNumber}.`,
            });
          } else if (lower.includes('edad') && (num <= 0 || num > 115)) {
            anomalies.push({
              id: `imp-age-${rowNumber}-${col}`,
              rowIndex: idx,
              rowNumber,
              column: col,
              valueDisplay: String(num),
              kind: 'Valor imposible',
              detail: `Edad fuera de rango razonable (${num}) en la fila ${rowNumber}.`,
            });
          }
        }
      }
    });
  });

  return anomalies;
}

export interface GroupComparisonRow {
  column: string;
  n0: number;
  mean0: number;
  sd0: number;
  n1: number;
  mean1: number;
  sd1: number;
  diff: number;
  pValue: number;
}

export function computeGroupComparison(
  rows: RawRow[],
  profiles: ColumnProfile[],
  targetCol: string,
  positiveClass: string
): GroupComparisonRow[] {
  if (!targetCol) return [];
  const numericCols = profiles.filter(
    (p) => p.name !== targetCol && p.userType === 'numeric' && p.mean !== undefined
  );

  return numericCols.map((prof) => {
    const g0: number[] = [];
    const g1: number[] = [];

    rows.forEach((row) => {
      const tVal = row[targetCol];
      const xVal = toNumericValue(row[prof.name]);
      if (isMissingValue(tVal) || xVal === null) return;
      if (String(tVal).trim() === positiveClass) {
        g1.push(xVal);
      } else {
        g0.push(xVal);
      }
    });

    const mean = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : NaN);
    const variance = (arr: number[], m: number) =>
      arr.length > 1 ? arr.reduce((a, b) => a + (b - m) ** 2, 0) / (arr.length - 1) : 0;

    const m0 = mean(g0);
    const m1 = mean(g1);
    const v0 = variance(g0, m0);
    const v1 = variance(g1, m1);

    let pValue = NaN;
    if (g0.length > 1 && g1.length > 1 && (v0 > 0 || v1 > 0)) {
      const se = Math.sqrt(v0 / g0.length + v1 / g1.length);
      if (se > 0) {
        const tStat = Math.abs(m1 - m0) / se;
        const num = (v0 / g0.length + v1 / g1.length) ** 2;
        const den =
          (v0 / g0.length) ** 2 / (g0.length - 1) + (v1 / g1.length) ** 2 / (g1.length - 1);
        const df = den > 0 ? num / den : g0.length + g1.length - 2;
        const cdf = jStat.studentt.cdf(tStat, Math.max(1, df));
        pValue = 2 * (1 - cdf);
      }
    }

    return {
      column: prof.name,
      n0: g0.length,
      mean0: m0,
      sd0: Math.sqrt(v0),
      n1: g1.length,
      mean1: m1,
      sd1: Math.sqrt(v1),
      diff: m1 - m0,
      pValue,
    };
  });
}

export async function parseUploadedDataset(file: File): Promise<{ rows: RawRow[]; error?: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (ext === 'csv' || ext === 'txt') {
    return new Promise((resolve) => {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: false,
        complete: (results) => {
          if (!results.data || results.data.length === 0) {
            resolve({ rows: [], error: 'El archivo CSV está vacío o no tiene encabezados válidos.' });
            return;
          }
          const cleaned = results.data.map((row) => {
            const obj: RawRow = {};
            Object.entries(row).forEach(([k, v]) => {
              const key = k.trim();
              if (!key) return;
              const num = toNumericValue(v);
              obj[key] = isMissingValue(v) ? null : num !== null ? num : String(v).trim();
            });
            return obj;
          });
          resolve({ rows: cleaned });
        },
        error: (err) => resolve({ rows: [], error: `Error leyendo CSV: ${err.message}` }),
      });
    });
  }

  if (ext === 'xlsx' || ext === 'xls') {
    try {
      const buf = await file.arrayBuffer();
      const workbook = XLSX.read(buf, { type: 'array' });
      const firstSheet = workbook.SheetNames[0];
      if (!firstSheet) {
        return { rows: [], error: 'El libro de Excel no contiene hojas.' };
      }
      const sheet = workbook.Sheets[firstSheet];
      const json = XLSX.utils.sheet_to_json<RawRow>(sheet, { defval: null });
      if (!json || json.length === 0) {
        return { rows: [], error: 'La primera hoja del archivo Excel está vacía.' };
      }
      const cleaned = json.map((row) => {
        const obj: RawRow = {};
        Object.entries(row).forEach(([k, v]) => {
          const key = String(k).trim();
          if (!key) return;
          const num = toNumericValue(v);
          obj[key] = isMissingValue(v) ? null : num !== null ? num : String(v).trim();
        });
        return obj;
      });
      return { rows: cleaned };
    } catch (e) {
      return {
        rows: [],
        error: `Error leyendo Excel: ${e instanceof Error ? e.message : 'formato inválido'}`,
      };
    }
  }

  return { rows: [], error: 'Formato no soportado. Sube un archivo .csv o .xlsx.' };
}
