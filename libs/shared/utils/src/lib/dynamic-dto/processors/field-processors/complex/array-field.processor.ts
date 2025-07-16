import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsDefined, IsOptional, ValidateNested } from 'class-validator';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../../core/interfaces/schema';
import { FieldProcessorRegistry } from '../../../infrastructure/registries/field-processor.registry';
import { ArrayFieldSchema } from '../../../core/interfaces/schema/complex/array-field.schema';
import { FieldType } from '../../../core/types/field.types';

@Injectable()
export class ArrayFieldProcessor extends BaseFieldProcessor<ArrayFieldSchema> {
  readonly supportedType = FieldType.array;

  constructor(@Inject(forwardRef(() => FieldProcessorRegistry)) private readonly processorRegistry: FieldProcessorRegistry) {
    super();
  }

  canProcess(schema: FieldSchema): schema is ArrayFieldSchema {
    return schema.type === FieldType.array;
  }

  generateValidationDecorators(schema: ArrayFieldSchema, isRequired: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined());
    } else {
      decorators.push(IsOptional());
    }

    // Array validation
    decorators.push(IsArray());

    // Size validation
    if (schema.minItems !== undefined) {
      decorators.push(ArrayMinSize(schema.minItems));
    }
    if (schema.maxItems !== undefined) {
      decorators.push(ArrayMaxSize(schema.maxItems));
    }

    // Item validation
    if (!Array.isArray(schema.items) && schema.items.type === FieldType.object) {
      decorators.push(ValidateNested({ each: true }));
    } else if (!Array.isArray(schema.items)) {
      const itemProcessor = this.processorRegistry.getProcessor(schema.items.type);
      const itemDecorators = itemProcessor.generateValidationDecorators(schema.items, true);
      // Apply each: true to item decorators
      decorators.push(...itemDecorators); //.map((decorator) => this.makeEachDecorator(decorator)));
    }
    // If schema.items is an array, handle accordingly if needed
    else if (Array.isArray(schema.items)) {
      // This case is not handled in the original code, but we can add a check if needed
      // For now, we'll skip this complex case
    }

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: ArrayFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Array coercion (order: 30)
    functions.push({
      order: 30,
      name: 'array_coercion',
      transform: ({ value }) => {
        if (Array.isArray(value)) return value;

        // Convert single values to arrays if not already an array
        if (value !== undefined && value !== null) {
          return [value];
        }

        return value;
      },
    });

    // Array processing (order: 40)
    functions.push({
      order: 40,
      name: 'array_processing',
      transform: ({ value }) => {
        if (!Array.isArray(value)) return value;

        let result = [...value];

        // Remove duplicates if configured
        if (schema.uniqueItems) {
          result = [...new Set(result)];
        }

        return result;
      },
      condition: (_, { value }) => Array.isArray(value),
    });

    // Basic item validation for complex items (order: 50)
    if (!Array.isArray(schema.items) && schema.items.type === FieldType.object) {
      functions.push({
        order: 50,
        name: 'item_validation',
        transform: ({ value }) => {
          if (!Array.isArray(value)) return value;

          // Basic validation that items are objects
          return value.filter((item) => item && typeof item === 'object');
        },
        condition: (_, { value }) => Array.isArray(value),
      });
    }

    return functions;
  }
}
