import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';

export interface NumberFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.number;
  readonly default?: number;

  // Range constraints
  readonly min?: number;
  readonly max?: number;
  readonly exclusiveMin?: number;
  readonly exclusiveMax?: number;
  readonly clamp?: boolean;

  // Precision
  readonly precision?: number;
  readonly scale?: number;
  readonly multipleOf?: number;

  // Type constraints
  readonly integer?: boolean;
  readonly positive?: boolean;
  readonly negative?: boolean;
  readonly finite?: boolean;

  // Format
  readonly format?: NumberFormat;
  readonly unit?: string;
  readonly currency?: CurrencyConfig;

  // Special values
  readonly allowNaN?: boolean;
  readonly allowInfinity?: boolean;
}

export const NumberFormat = {
  integer: 'integer',
  float: 'float',
  double: 'double',
  decimal: 'decimal',
  percentage: 'percentage',
  currency: 'currency',
  scientific: 'scientific',
} as const;

export type NumberFormat = (typeof NumberFormat)[keyof typeof NumberFormat];

export interface CurrencyConfig {
  readonly code: string; // ISO 4217
  readonly symbol?: string;
  readonly precision?: number;
  readonly format?: 'symbol' | 'code' | 'name';
}
