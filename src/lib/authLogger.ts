// Lightweight client-side logger for auth + route-guard diagnostics.
// Tagged + timestamped so issues are easy to spot in the browser console
// (and in any 3rd-party log forwarder that captures console output).

type Level = "debug" | "info" | "warn" | "error";

const TAG = "[Auth]";

const fmt = (level: Level, scope: string, msg: string, data?: unknown) => {
  const ts = new Date().toISOString();
  const prefix = `${TAG} ${ts} ${scope} →`;
  const args: unknown[] = [prefix, msg];
  if (data !== undefined) args.push(data);
  switch (level) {
    case "debug":
      console.debug(...args);
      break;
    case "info":
      console.info(...args);
      break;
    case "warn":
      console.warn(...args);
      break;
    case "error":
      console.error(...args);
      break;
  }
};

export const authLog = {
  debug: (scope: string, msg: string, data?: unknown) => fmt("debug", scope, msg, data),
  info: (scope: string, msg: string, data?: unknown) => fmt("info", scope, msg, data),
  warn: (scope: string, msg: string, data?: unknown) => fmt("warn", scope, msg, data),
  error: (scope: string, msg: string, data?: unknown) => fmt("error", scope, msg, data),
};

export const serializeError = (err: unknown) => {
  if (err instanceof Error) {
    return {
      name: err.name,
      message: err.message,
      stack: err.stack,
    };
  }
  try {
    return { value: JSON.parse(JSON.stringify(err)) };
  } catch {
    return { value: String(err) };
  }
};
