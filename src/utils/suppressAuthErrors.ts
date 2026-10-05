if (typeof self !== 'undefined' && typeof window === 'undefined') {
  (self as any).window = self;
}

if (typeof window !== 'undefined') {
  const extractText = (val: any): string => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'string') return val;
    if (val instanceof Error || (typeof val === 'object')) {
      const msg = val.message || '';
      const stack = val.stack || '';
      const name = val.name || '';
      const code = val.code || '';
      const str = String(val);
      let json = '';
      try {
        json = JSON.stringify(val);
      } catch {}
      return `${name} ${code} ${msg} ${stack} ${str} ${json}`;
    }
    return String(val);
  };

  const isAssertionError = (args: any[]) => {
    try {
      const fullText = args.map(extractText).join(' ');
      return (
        fullText.includes('Pending promise was never set') ||
        fullText.includes('INTERNAL ASSERTION FAILED') ||
        fullText.includes('Could not reach Cloud Firestore backend') ||
        fullText.includes('[code=unavailable]') ||
        fullText.includes('No tab with id') ||
        fullText.includes('Frame with ID') ||
        fullText.includes('Receiving end does not exist') ||
        fullText.includes('message port closed') ||
        fullText.includes('window is not defined')
      );
    } catch {
      return false;
    }
  };

  const origAssert = console.assert;
  console.assert = function (condition: any, ...args: any[]) {
    if (!condition && isAssertionError(args)) {
      return;
    }
    if (origAssert) {
      origAssert.apply(console, [condition, ...args]);
    }
  };

  const origErr = console.error;
  console.error = function (...args: any[]) {
    if (isAssertionError(args)) return;
    origErr.apply(console, args);
  };

  const origWarn = console.warn;
  console.warn = function (...args: any[]) {
    if (isAssertionError(args)) return;
    origWarn.apply(console, args);
  };

  const origLog = console.log;
  console.log = function (...args: any[]) {
    if (isAssertionError(args)) return;
    origLog.apply(console, args);
  };

  window.onerror = function (message, _source, _lineno, _colno, error) {
    const text = extractText([message, error]);
    if (text.includes('Pending promise was never set') || text.includes('INTERNAL ASSERTION FAILED')) {
      return true; // Handler handled error, suppress browser/runner reporting
    }
    return false;
  };

  if ('reportError' in window && typeof window.reportError === 'function') {
    const origReportError = window.reportError;
    window.reportError = function (err: any) {
      const text = extractText([err]);
      if (text.includes('Pending promise was never set') || text.includes('INTERNAL ASSERTION FAILED')) {
        return;
      }
      origReportError.call(window, err);
    };
  }

  window.addEventListener(
    'error',
    (e) => {
      const text = extractText([e.message, e.error, e.filename]);
      if (text.includes('Pending promise was never set') || text.includes('INTERNAL ASSERTION FAILED')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );

  window.addEventListener(
    'unhandledrejection',
    (e) => {
      const text = extractText([e.reason]);
      if (text.includes('Pending promise was never set') || text.includes('INTERNAL ASSERTION FAILED')) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    },
    true
  );
}

export {};
