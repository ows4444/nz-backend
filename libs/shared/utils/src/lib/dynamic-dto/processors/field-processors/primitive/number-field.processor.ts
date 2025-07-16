import { Injectable } from '@nestjs/common';
import { IsDefined, IsNumber, IsOptional, Max, Min } from 'class-validator';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { FieldType } from '../../../core/types/field.types';
import type { NumberFieldSchema } from '../../../core/interfaces/schema/primitive/number-field.schema';

@Injectable()
export class NumberFieldProcessor extends BaseFieldProcessor<NumberFieldSchema> {
  readonly supportedType = FieldType.number;

  canProcess(schema: FieldSchema): schema is NumberFieldSchema {
    return schema.type === FieldType.number;
  }

  generateValidationDecorators(schema: NumberFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    if (isRequired) {
      decorators.push(IsDefined(parentIsArray ? { each: true } : undefined));
    } else {
      decorators.push(IsOptional(parentIsArray ? { each: true } : undefined));
    }

    decorators.push(IsNumber({}, parentIsArray ? { each: true } : undefined));

    if (schema.min !== undefined) {
      decorators.push(Min(schema.min, parentIsArray ? { each: true } : undefined));
    }
    if (schema.max !== undefined) {
      decorators.push(Max(schema.max, parentIsArray ? { each: true } : undefined));
    }

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: NumberFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Type coercion transformation (order: 30)
    functions.push({
      order: 30,
      name: 'type_coercion',
      transform: ({ value }) => {
        if (value === null || value === undefined) return value;

        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (trimmed === '') return value;

          const num = Number(trimmed);
          return isNaN(num) ? value : num;
        }

        if (typeof value === 'boolean') {
          return value ? 1 : 0;
        }

        return value;
      },
    });

    // Precision and rounding (order: 40)
    if (schema.precision !== undefined || schema.scale !== undefined) {
      functions.push({
        order: 40,
        name: 'precision_rounding',
        transform: ({ value }) => {
          if (typeof value !== 'number') return value;

          if (schema.scale !== undefined) {
            return Math.round(value * Math.pow(10, schema.scale)) / Math.pow(10, schema.scale);
          }

          if (schema.precision !== undefined) {
            return Number(value.toPrecision(schema.precision));
          }

          return value;
        },
        condition: (_, { value }) => typeof value === 'number',
      });
    }

    // Range clamping (order: 50)
    if (schema.clamp && (schema.min !== undefined || schema.max !== undefined)) {
      functions.push({
        order: 50,
        name: 'range_clamping',
        transform: ({ value }) => {
          if (typeof value !== 'number') return value;

          let result = value;
          if (schema.min !== undefined && result < schema.min) {
            result = schema.min;
          }
          if (schema.max !== undefined && result > schema.max) {
            result = schema.max;
          }

          return result;
        },
        condition: (_, { value }) => typeof value === 'number',
      });
    }

    return functions;
  }
}
