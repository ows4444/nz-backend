import type { ValidationSeverity } from '../../../../core/enums/validation.enums';
import type { FieldSchema } from '..';
import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema, ValidationRule } from '../base/base-field.schema';

export interface ArrayFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.array;
  readonly items: FieldSchema | FieldSchema[]; // Single type or tuple

  // Size constraints
  readonly minItems?: number;
  readonly maxItems?: number;

  // Item constraints
  readonly uniqueItems?: boolean;
  readonly uniqueBy?: string[]; // Property paths for uniqueness

  // Ordering
  readonly sortable?: boolean;
  readonly sortBy?: string;
  readonly defaultSort?: SortConfig;

  // Validation
  readonly itemValidation?: readonly ValidationRule[];
  readonly crossItemValidation?: readonly CrossItemValidationRule[];
}

export interface SortConfig {
  readonly field: string;
  readonly direction: 'asc' | 'desc';
  readonly nullsFirst?: boolean;
}

export interface CrossItemValidationRule {
  readonly name: string;
  readonly condition: string; // Expression
  readonly message?: string;
  readonly severity?: ValidationSeverity;
}
