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

/**
 * Formats any date input into a user-friendly local display string: "DD-MM-YYYY at HH:mm"
 * Automatically uses the device's local time zone.
 */
export function formatToLocalDisplay(dateInput?: Date | string | number | null): string {
  if (!dateInput) return '';
  
  let d: Date | null = null;
  if (dateInput instanceof Date) {
    d = dateInput;
  } else if (typeof dateInput === 'number') {
    d = new Date(dateInput);
  } else {
    d = parseAnyDate(dateInput);
  }

  if (!d || isNaN(d.getTime())) return '';

  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  return `${day}-${month}-${year} at ${hours}:${minutes}`;
}

export function isNewShow(show: {
  isWishlist?: boolean;
  status?: string;
  sheetTabName?: string;
  addedTime?: number;
  createdTimestamp?: number;
  sessionAddedAt?: number;
  dateAdded?: string;
}): boolean {
  if (
    !show ||
    show.isWishlist ||
    String(show.status || '').toLowerCase().includes('wishlist') ||
    show.sheetTabName?.toLowerCase().includes('wishlist')
  ) {
    return false;
  }

  // Rule: HIDE if in Continue Watching (status is "Watching")
  const statusStr = String(show.status || '').toLowerCase();
  if (statusStr.includes('watching') || statusStr.includes('in progress') || statusStr.includes('⏳')) {
    return false;
  }

  const ONE_DAY_MS = 24 * 60 * 60 * 1000;
  const now = Date.now();

  const addedTime = show.addedTime || show.createdTimestamp || show.sessionAddedAt;
  if (addedTime) {
    const diff = now - addedTime;
    if (diff >= 0 && diff <= ONE_DAY_MS) return true;
  }

  if (show.dateAdded) {
    const parsed = parseAnyDate(show.dateAdded);
    if (parsed) {
      const diff = now - parsed.getTime();
      if (diff >= 0 && diff <= ONE_DAY_MS) return true;
    }
  }

  return false;
}
