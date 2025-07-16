import { forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Exclude } from 'class-transformer';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { FieldProcessorRegistry } from '../../infrastructure/registries/field-processor.registry';
import { ClassConstructor } from '../../core/types/common.types';

@Injectable()
export class DtoGenerationPipeline {
  private readonly logger = new Logger(DtoGenerationPipeline.name);
  private readonly generatedClasses = new Map<string, ClassConstructor<object>>();

  constructor(@Inject(forwardRef(() => FieldProcessorRegistry)) private readonly fieldProcessorRegistry: FieldProcessorRegistry) {}

  async generateAsync(schema: DynamicSchemaEntity): Promise<ClassConstructor<object>> {
    return new Promise((resolve, reject) => {
      try {
        const result = this.generate(schema);
        resolve(result);
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  generate(schema: DynamicSchemaEntity): ClassConstructor<object> {
    const className = this.generateClassName(schema.name, schema.version.toString());

    // Check if already generated
    if (this.generatedClasses.has(className)) {
      return this.generatedClasses.get(className)!;
    }

    const DynamicClass = this.createBaseClass(className, schema);

    // Process each field
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      try {
        const processor = this.fieldProcessorRegistry.getProcessor(fieldSchema.type);
        const isRequired = schema.getRequiredFields().includes(fieldName);

        const decorators = [
          ...processor.generateValidationDecorators(fieldSchema, isRequired, false),
          ...processor.generateTransformationDecorators(fieldSchema),
          ...processor.generateSerializationDecorators(fieldSchema, isRequired, schema.excludeAll),
        ];

        this.applyDecorators(DynamicClass, fieldName, decorators);
      } catch (error) {
        this.logger.error(`Failed to process field ${fieldName}`, {
          fieldName,
          fieldType: fieldSchema.type,
          error: error.message,
        });
        throw new Error(`Field processing failed for ${fieldName}: ${error.message}`);
      }
    }

    // Apply class-level decorators
    if (schema.excludeAll) {
      Exclude()(DynamicClass);
    }

    // Cache the generated class
    this.generatedClasses.set(className, DynamicClass);

    return DynamicClass;
  }

  private createBaseClass(className: string, schema: DynamicSchemaEntity): ClassConstructor<object> {
    const DynamicClass = function (this: Record<string, unknown>) {
      for (const propName of Object.keys(schema.properties)) {
        this[propName] = undefined;
      }
    } as unknown as ClassConstructor<object>;

    Object.defineProperty(DynamicClass, 'name', { value: className });
    return DynamicClass;
  }

  private generateClassName(name: string, version: string): string {
    return `${name}_v${version.replace(/\./g, '_')}`;
  }

  private applyDecorators(targetClass: ClassConstructor<object>, propertyName: string, decorators: PropertyDecorator[]): void {
    decorators.forEach((decorator) => {
      if (typeof decorator === 'function') {
        decorator(targetClass.prototype, propertyName);
      }
    });
  }
}
