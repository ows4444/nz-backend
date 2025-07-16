import type { FieldType } from '../../../types/field.types';
import type { BaseFieldSchema } from '../base/base-field.schema';

export interface BooleanFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.boolean;
  readonly default?: boolean;
  readonly trueValues?: readonly (string | number)[];
  readonly falseValues?: readonly (string | number)[];
  readonly caseSensitive?: boolean;
}
