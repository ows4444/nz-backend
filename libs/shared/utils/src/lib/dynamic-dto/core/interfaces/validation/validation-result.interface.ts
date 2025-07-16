import type { DeepReadonly } from '../../types/common.types';
import type { ValidationIssue } from './validation-issue.interface';

export interface ValidationResult {
  isValid: boolean;
  readonly issues: ValidationIssue[];
  readonly fieldPath?: string;
  readonly metadata?: DeepReadonly<Record<string, unknown>>;

  // Convenience getters
  readonly errors?: ValidationIssue[];
  readonly warnings?: ValidationIssue[];
  readonly infos?: ValidationIssue[];
}
