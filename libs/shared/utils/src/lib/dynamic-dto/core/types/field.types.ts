export const FieldType = {
  // Primitives
  string: 'string',
  number: 'number',
  boolean: 'boolean',

  // Specialized Primitives
  date: 'date',

  // Complex/Structured
  array: 'array',
  object: 'object',
} as const;

// 2. Extract type-safe values as union type
export type FieldTypeValue = (typeof FieldType)[keyof typeof FieldType];

// Create type-safe field type groups
export const FieldTypeGroups = {
  primitive: [FieldType.string, FieldType.number, FieldType.boolean] as const,
  specialized_primitive: [FieldType.date] as const,
  complex_structured: [FieldType.array, FieldType.object] as const,
} as const;

export type PrimitiveFieldType = (typeof FieldTypeGroups.primitive)[number];
export type SpecializedPrimitiveFieldType = (typeof FieldTypeGroups.specialized_primitive)[number];
export type ComplexStructuredFieldType = (typeof FieldTypeGroups.complex_structured)[number];
