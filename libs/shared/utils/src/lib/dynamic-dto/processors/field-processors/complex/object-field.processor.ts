import { Injectable } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDefined, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import type { FieldSchema } from '../../../core/interfaces/schema';
import type { ObjectFieldSchema } from '../../../core/interfaces/schema/complex/object-field.schema';
import { FieldType } from '../../../core/types/field.types';
import { NestedClassGeneratorService } from '../../../infrastructure/services/nested-class-generator.service';

@Injectable()
export class ObjectFieldProcessor extends BaseFieldProcessor<ObjectFieldSchema> {
  readonly supportedType = FieldType.object;

  constructor(private readonly nestedClassGenerator: NestedClassGeneratorService) {
    super();
  }

  canProcess(schema: FieldSchema): schema is ObjectFieldSchema {
    return schema.type === FieldType.object;
  }

  generateValidationDecorators(schema: ObjectFieldSchema, isRequired: boolean, parentIsArray = false): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];
    const options = parentIsArray ? { each: true } : undefined;

    if (isRequired) {
      decorators.push(IsDefined(options));
    } else {
      decorators.push(IsOptional(options));
    }

    decorators.push(IsObject(options));
    decorators.push(ValidateNested(options));

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: ObjectFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Nested class transformation (order: 30)
    if (schema.properties) {
      this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);

      functions.push({
        order: 30,
        name: 'nested_class',
        transform: ({ value }) => value, // Type decorator handles the transformation
      });

      // This is handled by the Type decorator, but we track it here for completeness
    }

    // Property filtering based on permissions (order: 40)
    functions.push({
      order: 40,
      name: 'property_filtering',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.filterPropertiesByPermissions(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    // Additional properties handling (order: 50)
    if (schema.additionalProperties === false) {
      functions.push({
        order: 50,
        name: 'additional_properties',
        transform: ({ value }) => {
          if (!value || typeof value !== 'object') return value;
          return this.removeAdditionalProperties(value as Record<string, unknown>, schema);
        },
        condition: (_, { value }) => Boolean(value && typeof value === 'object'),
      });
    }

    // Property validation and transformation (order: 60)
    functions.push({
      order: 60,
      name: 'property_transformation',
      transform: ({ value }) => {
        if (!value || typeof value !== 'object') return value;
        return this.transformObjectProperties(value as Record<string, unknown>, schema);
      },
      condition: (_, { value }) => Boolean(value && typeof value === 'object'),
    });

    return functions;
  }

  public generateEnhancedTransformationDecorators(schema: ObjectFieldSchema): PropertyDecorator[] {
    const decorators = super.generateTransformationDecorators(schema);

    // Add Type decorator for nested class generation
    if (schema.properties) {
      const nestedClass = this.nestedClassGenerator.generateNestedClass(schema.properties as Record<string, FieldSchema>, [...(schema.required ?? [])], schema.exclude ?? false);
      decorators.unshift(Type(() => nestedClass));
    }

    return decorators;
  }

  private filterPropertiesByPermissions(value: Record<string, unknown>, _schema: ObjectFieldSchema): Record<string, unknown> {
    // Implementation for permission-based property filtering
    return value;
  }

  private removeAdditionalProperties(value: Record<string, unknown>, schema: ObjectFieldSchema): Record<string, unknown> {
    const allowedKeys = new Set(Object.keys(schema.properties));
    const filtered: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(value)) {
      if (allowedKeys.has(key)) {
        filtered[key] = val;
      }
    }

    return filtered;
  }

  private transformObjectProperties(value: Record<string, unknown>, _schema: ObjectFieldSchema): Record<string, unknown> {
    // Apply property-level transformations
    return value;
  }
}
