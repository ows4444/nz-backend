import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';

export interface DateFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.date;
  readonly default?: Date | string | DateDefaultValue;

  // Format
  readonly format?: DateFormat;
  readonly customFormat?: string;

  // Range constraints
  readonly min?: Date | string;
  readonly max?: Date | string;

  // Timezone handling
  readonly timezone?: 'auto' | 'utc' | 'local' | (string & {});
  readonly preserveTimezone?: boolean;

  // Auto-update
  readonly autoUpdate?: readonly AutoUpdateTrigger[];

  // Validation
  readonly validateFuture?: boolean;
  readonly validatePast?: boolean;
  readonly validateBusinessDays?: boolean;
  readonly excludeDates?: readonly (Date | string)[];
  readonly includeDates?: readonly (Date | string)[];
}

export const DateFormat = {
  iso: 'iso',
  timestamp: 'timestamp',
  unix: 'unix',
  custom: 'custom',
  relative: 'relative',
} as const;

export type DateFormat = (typeof DateFormat)[keyof typeof DateFormat];

export interface DateDefaultValue {
  readonly type: 'now' | 'relative' | 'computed';
  readonly offset?: string; // e.g., '+7d', '-1M'
  readonly expression?: string;
}

export type AutoUpdateTrigger = 'onCreate' | 'onUpdate' | 'onRead' | 'scheduled';
