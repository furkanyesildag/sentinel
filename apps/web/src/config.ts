import { loadConfigFromEnv, validateConfig } from '@defirisk/core';

export const appConfig = loadConfigFromEnv(import.meta.env);

// Surface misconfiguration early in development without crashing production.
const configWarnings = validateConfig(appConfig);
if (configWarnings.length > 0 && import.meta.env.DEV) {
  console.warn('[Sentinel] config warnings:\n - ' + configWarnings.join('\n - '));
}
