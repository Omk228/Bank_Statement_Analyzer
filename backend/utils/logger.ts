export function maskAccountNumber(acc?: string): string {
  if (!acc) return '';
  const cleaned = acc.trim();
  if (cleaned.length <= 4) return 'XXXX';
  return 'X'.repeat(cleaned.length - 4) + cleaned.slice(-4);
}

export function maskPan(pan?: string): string {
  if (!pan) return '';
  const cleaned = pan.trim();
  if (cleaned.length !== 10) return 'XXXXX' + cleaned.slice(-4);
  return 'XXXXX' + cleaned.slice(5);
}

export function maskAadhaar(aadhaar?: string): string {
  if (!aadhaar) return '';
  const digits = aadhaar.replace(/\D/g, '');
  if (digits.length >= 4) {
    return 'XXXX-XXXX-' + digits.slice(-4);
  }
  return 'XXXX-XXXX-XXXX';
}

export function maskEmail(email?: string): string {
  if (!email || !email.includes('@')) return '';
  const [local, domain] = email.split('@');
  if (local.length <= 2) return `**@${domain}`;
  return `${local[0]}***${local.slice(-1)}@${domain}`;
}

export interface StructuredLog {
  requestId: string;
  timestamp: string;
  stage: string;
  level: 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';
  message: string;
  fileSize?: number;
  fileType?: string;
  classification?: string;
  confidence?: number;
  durationMs?: number;
  errorCode?: string;
  [key: string]: any;
}

export const logger = {
  info: (log: Omit<StructuredLog, 'level' | 'timestamp'>) => {
    console.log(
      JSON.stringify({
        level: 'INFO',
        timestamp: new Date().toISOString(),
        ...log,
      })
    );
  },
  warn: (log: Omit<StructuredLog, 'level' | 'timestamp'>) => {
    console.warn(
      JSON.stringify({
        level: 'WARN',
        timestamp: new Date().toISOString(),
        ...log,
      })
    );
  },
  error: (log: Omit<StructuredLog, 'level' | 'timestamp'>) => {
    console.error(
      JSON.stringify({
        level: 'ERROR',
        timestamp: new Date().toISOString(),
        ...log,
      })
    );
  },
  debug: (log: Omit<StructuredLog, 'level' | 'timestamp'>) => {
    if (process.env.NODE_ENV !== 'production') {
      console.debug(
        JSON.stringify({
          level: 'DEBUG',
          timestamp: new Date().toISOString(),
          ...log,
        })
      );
    }
  },
};
