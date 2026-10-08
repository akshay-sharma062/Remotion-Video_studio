/**
 * getArgs — robust CLI argument parsing for tsx on Windows.
 *
 * tsx on Windows strips process.argv. npm stores the raw arguments in
 * process.env.npm_config_argv as a JSON string. This function tries
 * process.argv first, then falls back to npm_config_argv.
 */

function parseNpmConfigArgv(): string[] {
  const raw = process.env.npm_config_argv;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      // ["run", "script-name", "arg1", "arg2", ...]
      return parsed.slice(2);
    }
  } catch {
    // not valid JSON, ignore
  }
  return [];
}

export function getArgs(offset = 2): string[] {
  const argv = process.argv.slice(offset);
  if (argv.length > 0) return argv;
  return parseNpmConfigArgv();
}
