import { Injectable } from '@nestjs/common';
import { IsDate, IsDateString, IsDefined, IsOptional } from 'class-validator';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../../core/interfaces/schema';
import { DateFieldSchema, DateFormat } from '../../../core/interfaces/schema/specialized-primitives/date-field.schema';
import { FieldType } from '../../../core/types/field.types';

@Injectable()
export class DateFieldProcessor extends BaseFieldProcessor<DateFieldSchema> {
  readonly supportedType = FieldType.date;

  canProcess(schema: FieldSchema): schema is DateFieldSchema {
    return schema.type === FieldType.date;
  }

  generateValidationDecorators(schema: DateFieldSchema, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const options = parentIsArray ? { each: true } : undefined;

    if (isRequired) {
      decorators.push(IsDefined(options));
    } else {
      decorators.push(IsOptional(options));
    }

    // Date validation based on format
    switch (schema.format) {
      case DateFormat.iso:
        decorators.push(IsDateString({}, options));
        break;
      default:
        decorators.push(IsDate(options));
    }

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: DateFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Date parsing transformation (order: 30)
    functions.push({
      order: 30,
      name: 'date_parsing',
      transform: ({ value }) => {
        if (!value) return value;
        if (value instanceof Date) return value;

        if (typeof value === 'string') {
          const trimmed = value.trim();
          if (!trimmed) return value;

          // Try parsing as ISO string first
          const date = new Date(trimmed);
          if (!isNaN(date.getTime())) {
            return date;
          }

          // Try parsing with specific format if provided
          if (schema.format === DateFormat.iso) {
            const isoDate = new Date(trimmed);
            return !isNaN(isoDate.getTime()) ? isoDate : value;
          }

          return value;
        }

        if (typeof value === 'number') {
          // Assume timestamp
          const date = new Date(value);
          return !isNaN(date.getTime()) ? date : value;
        }

        return value;
      },
    });

    // Date formatting transformation (order: 40)
    if (schema.format) {
      functions.push({
        order: 40,
        name: 'date_formatting',
        transform: ({ value }) => {
          if (!(value instanceof Date)) return value;

          switch (schema.format) {
            case DateFormat.iso:
              return value.toISOString();
            default:
              return value;
          }
        },
        condition: (_, { value }) => value instanceof Date,
      });
    }

    return functions;
  }
}
