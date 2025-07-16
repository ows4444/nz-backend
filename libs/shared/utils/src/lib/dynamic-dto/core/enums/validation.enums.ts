export const ValidationStrategy = {
  strict: 'strict',
  loose: 'loose',
  transform: 'transform',
  sanitize: 'sanitize',
  contextual: 'contextual',
} as const;

export type ValidationStrategy = (typeof ValidationStrategy)[keyof typeof ValidationStrategy];

export const ValidationSeverity = {
  error: 'error',
  warning: 'warning',
  info: 'info',
  debug: 'debug',
} as const;

export type ValidationSeverity = (typeof ValidationSeverity)[keyof typeof ValidationSeverity];
