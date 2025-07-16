import type { ValidationSeverity } from '../../enums/validation.enums';
import type { DeepReadonly } from '../../types/common.types';

export interface ValidationIssue {
  readonly severity: ValidationSeverity;
  readonly code: string;
  readonly message: string;
  readonly fieldPath?: string;
  readonly value?: unknown;
  readonly constraint?: string;
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
}
