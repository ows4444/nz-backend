import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { FieldSchema } from '../../core/interfaces/schema';
import { ClassConstructor } from '../../core/types/common.types';
import { FieldProcessorRegistry } from '../registries/field-processor.registry';

export interface INestedClassGenerator {
  generateNestedClass(properties: Record<string, FieldSchema>, required?: string[], exclude?: boolean): ClassConstructor<object>;
}

@Injectable()
export class NestedClassGeneratorService implements INestedClassGenerator {
  private readonly logger = new Logger(NestedClassGeneratorService.name);
  private readonly generatedClasses = new Map<string, ClassConstructor<object>>();
  private classCounter = 0;

  constructor(@Inject(forwardRef(() => FieldProcessorRegistry)) private readonly fieldProcessorRegistry: FieldProcessorRegistry) {}

  generateNestedClass(properties: Record<string, FieldSchema>, required: string[] = [], exclude = false): ClassConstructor<object> {
    const cacheKey = this.generateCacheKey(properties, required, exclude);

    if (this.generatedClasses.has(cacheKey)) {
      return this.generatedClasses.get(cacheKey)!;
    }

    const className = this.generateUniqueClassName();
    const DynamicClass = this.createBaseClass(className, properties);

    // Process each field
    for (const [fieldName, fieldSchema] of Object.entries(properties)) {
      try {
        const processor = this.fieldProcessorRegistry.getProcessor(fieldSchema.type);
        const isRequired = required.includes(fieldName);

        const decorators = [
          ...processor.generateValidationDecorators(fieldSchema, isRequired, false),
          ...processor.generateTransformationDecorators(fieldSchema),
          ...processor.generateSerializationDecorators(fieldSchema, isRequired, exclude),
        ];

        this.applyDecorators(DynamicClass, fieldName, decorators);
      } catch (error) {
        this.logger.error(`Failed to process nested field ${fieldName}`, {
          fieldName,
          fieldType: fieldSchema.type,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        throw new Error(`Nested field processing failed for ${fieldName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (exclude) {
      Exclude()(DynamicClass);
    }

    this.generatedClasses.set(cacheKey, DynamicClass);
    return DynamicClass;
  }

  private createBaseClass(className: string, properties: Record<string, FieldSchema>): ClassConstructor<object> {
    const DynamicClass = function (this: Record<string, unknown>) {
      for (const propName of Object.keys(properties)) {
        this[propName] = undefined;
      }
    } as unknown as ClassConstructor<object>;

    Object.defineProperty(DynamicClass, 'name', { value: className });
    return DynamicClass;
  }

  private generateUniqueClassName(): string {
    return `DynamicNested${++this.classCounter}_${Date.now()}`;
  }

  private generateCacheKey(properties: Record<string, FieldSchema>, required: string[], exclude: boolean): string {
    const propertiesHash = JSON.stringify(properties, Object.keys(properties).sort());
    const requiredHash = JSON.stringify(required.sort());
    return `${propertiesHash}:${requiredHash}:${exclude}`;
  }

  private applyDecorators(targetClass: ClassConstructor<object>, propertyName: string, decorators: PropertyDecorator[]): void {
    decorators.forEach((decorator) => {
      if (typeof decorator === 'function') {
        decorator(targetClass.prototype, propertyName);
      }
    });
  }
}
