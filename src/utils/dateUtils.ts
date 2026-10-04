export function parseAnyDate(dateStr?: string | null): Date | null {
  if (!dateStr || !String(dateStr).trim()) return null;
  const str = String(dateStr).trim();

  // Match DD-MM-YYYY or DD/MM/YYYY with optional time
  const ddmmMatch = str.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (ddmmMatch) {
    const [_, d, m, y, hr, min, sec] = ddmmMatch;
    const hours = hr !== undefined ? parseInt(hr, 10) : 0;
    const minutes = min !== undefined ? parseInt(min, 10) : 0;
    const seconds = sec !== undefined ? parseInt(sec, 10) : 0;
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hours, minutes, seconds);
  }

  // Match YYYY-MM-DD or YYYY/MM/DD with optional time
  const yyyymmMatch = str.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})(?:[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (yyyymmMatch) {
    const [_, y, m, d, hr, min, sec] = yyyymmMatch;
    const hours = hr !== undefined ? parseInt(hr, 10) : 0;
    const minutes = min !== undefined ? parseInt(min, 10) : 0;
    const seconds = sec !== undefined ? parseInt(sec, 10) : 0;
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), hours, minutes, seconds);
  }

  // Match 4-digit year e.g. 2026 or 2027
  const yearMatch = str.match(/^(\d{4})$/);
  if (yearMatch) {
    const y = parseInt(yearMatch[1], 10);
    return new Date(y, 0, 1, 0, 0, 0);
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) return parsed;
  return null;
}

export function formatToDDMMYYYY(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? parseAnyDate(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return typeof dateInput === 'string' ? dateInput : '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}-${month}-${year}`;
}

export function formatToYYYYMMDD(dateInput?: Date | string | null): string {
  if (!dateInput) return '';
  const d = typeof dateInput === 'string' ? parseAnyDate(dateInput) : dateInput;
  if (!d || isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

export function getTodayDDMMYYYY(): string {
  return formatToDDMMYYYY(new Date());
}

export function extractDateOnly(dateStr?: string | null): string {
  if (!dateStr || !String(dateStr).trim()) return '';
  const str = String(dateStr).trim();
  const datePart = str.split(/[\sT]/)[0];
  const ddmm = datePart.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  if (ddmm) {
    const [_, d, m, y] = ddmm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const yyyymm = datePart.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  if (yyyymm) {
    const [_, y, m, d] = yyyymm;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return '';
}

export function extractTimeOnly(dateStr?: string | null): string {
  if (!dateStr || !String(dateStr).trim()) return '';
  const str = String(dateStr).trim();
  const match = str.match(/[\sT](\d{1,2}:\d{2})/);
  if (match) {
    const [h, m] = match[1].split(':');
    return `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
  return '';
}

export function combineDateAndTime(dateStr?: string | null, timeStr?: string | null): string {
  if (!dateStr || !String(dateStr).trim()) return '';
  const rawDate = String(dateStr).trim();
  let ddmmyyyy = '';
  const yyyymm = rawDate.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})/);
  if (yyyymm) {
    const [_, y, m, d] = yyyymm;
    ddmmyyyy = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
  } else {
    const ddmm = rawDate.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})/);
    if (ddmm) {
      const [_, d, m, y] = ddmm;
      ddmmyyyy = `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
    } else {
      ddmmyyyy = formatToDDMMYYYY(rawDate);
    }
  }

  if (!ddmmyyyy) return '';
  const cleanTime = (timeStr || '').trim();
  if (cleanTime && /^\d{1,2}:\d{2}$/.test(cleanTime)) {
    const [h, m] = cleanTime.split(':');
    return `${ddmmyyyy} ${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
  }

  return ddmmyyyy;
}

/* 
 * Helper functions for date parsing and formatting.
 */
