import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { BaseFieldValidator } from '../../core/abstractions/base-field-validator.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldType, FieldTypeValue } from '../../core/types/field.types';
import { ValidationResultBuilder } from '../../core/utils/validation-result.builder';

interface ValidatorStats {
  totalValidators: number;
  supportedTypes: FieldTypeValue[];
  initialized: boolean;
}

// Import validators
import { BooleanFieldValidator } from '../../validators/field-validators/primitive/boolean-field.validator';
import { NumberFieldValidator } from '../../validators/field-validators/primitive/number-field.validator';
import { StringFieldValidator } from '../../validators/field-validators/primitive/string-field.validator';
import { ArrayFieldValidator } from '../../validators/field-validators/complex/array-field.validator';
import { ObjectFieldValidator } from '../../validators/field-validators/complex/object-field.validator';
import { DateFieldValidator } from '../../validators/field-validators/specialized/date-field.validator';

@Injectable()
export class FieldValidatorRegistry implements OnModuleInit {
  private readonly logger = new Logger(FieldValidatorRegistry.name);
  private readonly validators = new Map<FieldTypeValue, BaseFieldValidator>();
  private initialized = false;

  constructor(
    private readonly booleanValidator: BooleanFieldValidator,
    private readonly numberValidator: NumberFieldValidator,
    private readonly stringValidator: StringFieldValidator,
    private readonly arrayValidator: ArrayFieldValidator,
    private readonly objectValidator: ObjectFieldValidator,
    private readonly dateValidator: DateFieldValidator,
  ) {}

  onModuleInit(): void {
    if (this.initialized) return;

    try {
      this.registerValidators();
      this.initialized = true;
      this.logger.log(`Initialized ${this.validators.size} field validators`);
    } catch (error) {
      this.logger.error('Failed to initialize field validators', error);
      throw error;
    }
  }

  private registerValidators(): void {
    const validatorMappings = [
      { type: FieldType.boolean, validator: this.booleanValidator },
      { type: FieldType.number, validator: this.numberValidator },
      { type: FieldType.string, validator: this.stringValidator },
      { type: FieldType.array, validator: this.arrayValidator },
      { type: FieldType.object, validator: this.objectValidator },
      { type: FieldType.date, validator: this.dateValidator },
    ];

    for (const { type, validator } of validatorMappings) {
      if (validator) {
        this.validators.set(type, validator);
        this.logger.debug(`Registered validator for type: ${type}`);
      } else {
        this.logger.warn(`Validator not available for type: ${type}`);
      }
    }
  }

  registerValidator(validator: BaseFieldValidator): void {
    if (!validator?.supportedType) {
      this.logger.warn('Invalid validator provided');
      return;
    }

    const existingValidator = this.validators.get(validator.supportedType);
    if (existingValidator && existingValidator.priority > validator.priority) {
      this.logger.debug(`Keeping higher priority validator for type ${validator.supportedType}`);
      return;
    }

    this.validators.set(validator.supportedType, validator);
    this.logger.debug(`Registered validator: ${validator.name} for type: ${validator.supportedType}`);
  }

  getValidator(type: FieldTypeValue): BaseFieldValidator | undefined {
    return this.validators.get(type);
  }

  validateField(schema: FieldSchema, context: ValidationContext): ValidationResult {
    try {
      const validator = this.getValidator(schema.type);

      if (!validator) {
        this.logger.warn(`No validator found for field type: ${schema.type}`, {
          fieldPath: context.fieldPath,
          availableValidators: Array.from(this.validators.keys()),
        });

        return ValidationResultBuilder.error('VALIDATOR_NOT_FOUND', `No validator found for field type: ${schema.type}`, context.fieldPath, { type: schema.type });
      }

      if (!validator.canValidate(schema)) {
        return ValidationResultBuilder.error('VALIDATOR_INCOMPATIBLE', `Validator cannot handle schema for field: ${context.fieldPath}`, context.fieldPath, {
          validator: validator.name,
          fieldType: (schema as { type: string }).type,
        });
      }

      return validator.validate(schema, context);
    } catch (error) {
      this.logger.error('Field validation failed', {
        fieldPath: context.fieldPath,
        fieldType: schema.type,
        error: error.message,
      });

      return ValidationResultBuilder.error('VALIDATION_ERROR', `Validation failed for field '${context.fieldPath}': ${error.message}`, context.fieldPath, { error: error.message });
    }
  }

  getAllValidators(): ReadonlyMap<FieldTypeValue, BaseFieldValidator> {
    return new Map(this.validators);
  }

  unregisterValidator(type: FieldTypeValue): boolean {
    const removed = this.validators.delete(type);
    if (removed) {
      this.logger.debug(`Unregistered validator for type: ${type}`);
    }
    return removed;
  }

  getValidatorStats(): ValidatorStats {
    return {
      totalValidators: this.validators.size,
      supportedTypes: Array.from(this.validators.keys()),
      initialized: this.initialized,
    };
  }
}
