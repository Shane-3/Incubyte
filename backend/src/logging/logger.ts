/** One structured log line. Only allow-listed request facts go in; never bodies, cookies or headers. */
export interface LogEntry {
  msg: string;
  [field: string]: unknown;
}

export interface Logger {
  info(entry: LogEntry): void;
  warn(entry: LogEntry): void;
  error(entry: LogEntry): void;
}

/**
 * JSON lines. JSON.stringify escapes CR/LF, so user-controlled values (such as a path) cannot forge extra lines.
 */
export function jsonLogger(write: (line: string) => void = (line) => process.stdout.write(line)): Logger {
  const log = (level: string) => (entry: LogEntry) =>
    write(`${JSON.stringify({ time: new Date().toISOString(), level, ...entry })}\n`);
  return { info: log('info'), warn: log('warn'), error: log('error') };
}

export const silentLogger: Logger = { info: () => undefined, warn: () => undefined, error: () => undefined };
