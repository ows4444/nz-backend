import { Injectable } from '@nestjs/common';
import { IsBoolean, IsDefined, IsOptional } from 'class-validator';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';

import type { FieldSchema } from '../../../core/interfaces/schema';
import { FieldType } from '../../../core/types/field.types';
import type { BooleanFieldSchema } from '../../../core/interfaces/schema/primitive/boolean-field.schema';

@Injectable()
export class BooleanFieldProcessor extends BaseFieldProcessor<BooleanFieldSchema> {
  readonly supportedType = FieldType.boolean;

  canProcess(schema: FieldSchema): schema is BooleanFieldSchema {
    return schema.type === FieldType.boolean;
  }

  generateValidationDecorators(_schema: BooleanFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    if (isRequired) {
      decorators.push(IsDefined(parentIsArray ? { each: true } : undefined));
    } else {
      decorators.push(IsOptional(parentIsArray ? { each: true } : undefined));
    }

    decorators.push(IsBoolean(parentIsArray ? { each: true } : undefined));

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: BooleanFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Boolean coercion transformation (order: 30)
    functions.push({
      order: 30,
      name: 'boolean_coercion',
      transform: ({ value }) => {
        // Apply custom true/false mappings first
        if (schema.trueValues?.includes(value as string | number)) return true;
        if (schema.falseValues?.includes(value as string | number)) return false;

        // Handle string coercion
        if (typeof value === 'string') {
          const lowerValue = value.toLowerCase().trim();
          if (lowerValue === 'true' || lowerValue === '1' || lowerValue === 'yes' || lowerValue === 'on') {
            return true;
          }
          if (lowerValue === 'false' || lowerValue === '0' || lowerValue === 'no' || lowerValue === 'off' || lowerValue === '') {
            return false;
          }
        }

        // Handle number coercion
        if (typeof value === 'number') {
          return value !== 0;
        }

        // Fallback boolean coercion
        return Boolean(value);
      },
    });

    return functions;
  }
}
