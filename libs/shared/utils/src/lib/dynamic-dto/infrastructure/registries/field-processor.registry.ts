import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldProcessor } from '../../core/abstractions/base-field-processor.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { FieldTypeValue } from '../../core/types/field.types';

// Import processors
import { StringFieldProcessor } from '../../processors/field-processors/primitive/string-field.processor';
import { NumberFieldProcessor } from '../../processors/field-processors/primitive/number-field.processor';
import { BooleanFieldProcessor } from '../../processors/field-processors/primitive/boolean-field.processor';
import { DateFieldProcessor } from '../../processors/field-processors/specialized/date-field.processor';
import { ArrayFieldProcessor } from '../../processors/field-processors/complex/array-field.processor';
import { ObjectFieldProcessor } from '../../processors/field-processors/complex/object-field.processor';

interface ProcessorStats {
  totalProcessors: number;
  supportedTypes: FieldTypeValue[];
  initialized: boolean;
}

@Injectable()
export class FieldProcessorRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldProcessorRegistry.name);
  private readonly processors = new Map<FieldTypeValue, BaseFieldProcessor>();
  private initialized = false;

  constructor(
    private readonly stringProcessor: StringFieldProcessor,
    private readonly numberProcessor: NumberFieldProcessor,
    private readonly booleanProcessor: BooleanFieldProcessor,
    private readonly dateProcessor: DateFieldProcessor,
    private readonly arrayProcessor: ArrayFieldProcessor,
    private readonly objectProcessor: ObjectFieldProcessor,
  ) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      // Register all processors
      this.registerProcessor(this.stringProcessor);
      this.registerProcessor(this.numberProcessor);
      this.registerProcessor(this.booleanProcessor);
      this.registerProcessor(this.dateProcessor);
      this.registerProcessor(this.arrayProcessor);
      this.registerProcessor(this.objectProcessor);

      this.initialized = true;
      this.logger.log(`Initialized ${this.processors.size} field processors`);
    } catch (error) {
      this.logger.error('Failed to initialize field processors', error instanceof Error ? error.message : 'Unknown error');
      throw error;
    }
  }

  registerProcessor(processor: BaseFieldProcessor): void {
    if (!processor?.supportedType) {
      this.logger.warn('Invalid processor provided', { processor: processor?.constructor.name });
      return;
    }

    const existingProcessor = this.processors.get(processor.supportedType);
    if (existingProcessor) {
      this.logger.warn(`Processor for type ${processor.supportedType} already exists, overriding`, {
        existing: existingProcessor.constructor.name,
        new: processor.constructor.name,
      });
    }

    this.processors.set(processor.supportedType, processor);
    this.logger.debug(`Registered processor for type: ${processor.supportedType}`);
  }

  getProcessor(type: FieldTypeValue): BaseFieldProcessor {
    const processor = this.processors.get(type);
    if (!processor) {
      this.logger.error(`No processor found for field type: ${type}`, {
        availableTypes: Array.from(this.processors.keys()),
      });
      throw new Error(`No processor found for field type: ${type}`);
    }
    return processor;
  }

  processField(
    schema: FieldSchema,
    isRequired: boolean,
  ): {
    validationDecorators: PropertyDecorator[];
    transformationDecorators: PropertyDecorator[];
    serializationDecorators: PropertyDecorator[];
  } {
    try {
      const processor = this.getProcessor(schema.type);

      if (!processor.canProcess(schema)) {
        throw new Error(`Processor ${processor.constructor.name} cannot handle schema for type: ${(schema as { type: string }).type}`);
      }

      return {
        validationDecorators: processor.generateValidationDecorators(schema, isRequired),
        transformationDecorators: processor.generateTransformationDecorators(schema),
        serializationDecorators: processor.generateSerializationDecorators(schema, isRequired, false),
      };
    } catch (error) {
      this.logger.error('Failed to process field', {
        fieldType: schema.type,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }
  }

  hasProcessor(type: FieldTypeValue): boolean {
    return this.processors.has(type);
  }

  getAllProcessors(): BaseFieldProcessor[] {
    return Array.from(this.processors.values());
  }

  getSupportedTypes(): FieldTypeValue[] {
    return Array.from(this.processors.keys());
  }

  getProcessorStats(): ProcessorStats {
    return {
      totalProcessors: this.processors.size,
      supportedTypes: this.getSupportedTypes(),
      initialized: this.initialized,
    };
  }
}
