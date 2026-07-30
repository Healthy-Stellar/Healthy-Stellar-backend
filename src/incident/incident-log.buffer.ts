/**
 * In-memory ring buffer that captures the last N structured log entries.
 *
 * Pino writes to stdout; we can't easily tail it at runtime. Instead, the
 * CustomLoggerService pushes entries here so IncidentEvidenceService can
 * include recent logs in an evidence bundle without hitting the database or
 * an external log aggregator.
 *
 * The buffer is intentionally small (default 200 entries) to keep memory
 * overhead negligible. It is a singleton so all logger instances share it.
 */

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  context?: string;
  traceId?: string;
}

const MAX_ENTRIES = parseInt(process.env.INCIDENT_LOG_BUFFER_SIZE || '200', 10);
const buffer: LogEntry[] = [];

export function pushLogEntry(entry: LogEntry): void {
  if (buffer.length >= MAX_ENTRIES) {
    buffer.shift(); // drop oldest
  }
  buffer.push(entry);
}

export function getRecentLogs(n = 50): LogEntry[] {
  return buffer.slice(-n);
}
