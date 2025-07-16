import type { FieldType, FieldTypeValue } from '../../../core/types/field.types';
import type { ArrayFieldSchema, ObjectFieldSchema } from './complex';
import type { BooleanFieldSchema, NumberFieldSchema, StringFieldSchema } from './primitive';
import type { DateFieldSchema } from './specialized-primitives';

export * from './base/base-field.schema';
export * from './complex';
export * from './primitive';
export * from './specialized-primitives';

export type FieldSchema =
  // Primitives
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema

  // Specialized Primitives
  | DateFieldSchema

  // Complex/Structured
  | ArrayFieldSchema
  | ObjectFieldSchema;

export type FieldSchemaOfType<T extends FieldTypeValue> = T extends typeof FieldType.string
  ? StringFieldSchema
  : T extends typeof FieldType.number
    ? NumberFieldSchema
    : T extends typeof FieldType.boolean
      ? BooleanFieldSchema
      : T extends typeof FieldType.date
        ? DateFieldSchema
        : T extends typeof FieldType.array
          ? ArrayFieldSchema
          : T extends typeof FieldType.object
            ? ObjectFieldSchema
            : never;
