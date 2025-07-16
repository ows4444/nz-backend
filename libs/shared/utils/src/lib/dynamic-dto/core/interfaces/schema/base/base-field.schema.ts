import type { ValidationSeverity, ValidationStrategy } from '../../../../core/enums/validation.enums';
import type { DeepReadonly } from '../../../types/common.types';
import type { FieldTypeValue } from '../../../types/field.types';

export interface BaseFieldSchema {
  readonly type: FieldTypeValue;
  readonly id?: string;
  readonly name?: string;
  readonly title?: string;
  readonly description?: string;
  readonly default?: unknown;
  readonly nullable?: boolean;
  readonly readonly?: boolean; // if readonly,  and autoGenerate is set, it will not be included in the DTO
  readonly version?: string;

  // Lifecycle
  readonly deprecated?: DeprecationInfo;
  readonly experimental?: boolean;

  // Validation
  readonly validationStrategy?: ValidationStrategy;
  readonly customValidators?: readonly string[];
  readonly conditionalValidation?: readonly ConditionalValidation[];

  // UI/Display
  readonly displayHints?: DisplayHints;
  readonly expose?: boolean;
  readonly exclude?: boolean;

  // Access Control
  readonly permissions?: FieldPermissions;

  // Metadata
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
  readonly tags?: readonly string[];
  readonly category?: string;
}

export interface DeprecationInfo {
  readonly since?: string;
  readonly reason?: string;
  readonly replacedBy?: string;
  readonly removeInVersion?: string;
  readonly migrationGuide?: string;
}

export interface ConditionalValidation {
  readonly condition: SerializableCondition;
  readonly validationRules: readonly ValidationRule[];
  readonly errorMessage?: string;
  readonly priority?: number;
}

export interface SerializableCondition {
  readonly field: string;
  readonly operator: ComparisonOperator;
  readonly value?: unknown;
  readonly logicalOperator?: LogicalOperator;
  readonly nested?: readonly SerializableCondition[];
}

export type ComparisonOperator = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'nin' | 'exists' | 'regex' | 'between';
export type LogicalOperator = 'and' | 'or' | 'not';

export interface ValidationRule {
  readonly type: string;
  readonly params?: DeepReadonly<Record<string, unknown>>;
  readonly message?: string;
  readonly severity?: ValidationSeverity;
}

export interface DisplayHints {
  readonly label?: string;
  readonly placeholder?: string;
  readonly helpText?: string;
  readonly widget?: WidgetType;
  readonly widgetProps?: DeepReadonly<Record<string, unknown>>;
  readonly group?: string;
  readonly order?: number;
  readonly hidden?: boolean;
  readonly collapsible?: boolean;
  readonly validation?: ValidationDisplayHints;
}

export type WidgetType = 'input' | 'textarea' | 'select' | 'checkbox' | 'radio' | 'file' | 'date' | 'color' | 'range' | 'custom';

export interface ValidationDisplayHints {
  readonly showInline?: boolean;
  readonly showSummary?: boolean;
  readonly debounceMs?: number;
}

export interface FieldPermissions {
  readonly read?: readonly string[];
  readonly write?: readonly string[];
  readonly create?: readonly string[];
  readonly update?: readonly string[];
  readonly delete?: readonly string[];
}
