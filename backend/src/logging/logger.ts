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
