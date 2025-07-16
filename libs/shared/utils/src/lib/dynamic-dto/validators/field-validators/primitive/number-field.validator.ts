import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { FieldType } from '../../../core/types/field.types';
import { BaseFieldSchema } from '../../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationResultBuilder } from '../../../core/utils/validation-result.builder';
import { NumberFieldSchema } from '../../../core/interfaces/schema/primitive/number-field.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NumberFieldValidator extends BaseFieldValidator<NumberFieldSchema> {
  readonly supportedType = FieldType.number;
  readonly priority = 100;
  readonly name = 'NumberFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is NumberFieldSchema {
    return schema.type === FieldType.number;
  }

  validateStructure(schema: NumberFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate range constraints
    if (schema.min !== undefined && schema.max !== undefined && schema.min > schema.max) {
      builder.addError('NUMBER_INVALID_RANGE', `min (${schema.min}) cannot be greater than max (${schema.max})`, { min: schema.min, max: schema.max });
    }

    if (schema.exclusiveMin !== undefined && schema.exclusiveMax !== undefined && schema.exclusiveMin >= schema.exclusiveMax) {
      builder.addError('NUMBER_INVALID_EXCLUSIVE_RANGE', `exclusiveMin (${schema.exclusiveMin}) must be less than exclusiveMax (${schema.exclusiveMax})`, {
        exclusiveMin: schema.exclusiveMin,
        exclusiveMax: schema.exclusiveMax,
      });
    }

    // Validate precision constraints
    if (schema.precision !== undefined && schema.precision < 0) {
      builder.addError('NUMBER_INVALID_PRECISION', 'precision must be non-negative', schema.precision);
    }

    if (schema.scale !== undefined && schema.scale < 0) {
      builder.addError('NUMBER_INVALID_SCALE', 'scale must be non-negative', schema.scale);
    }

    if (schema.precision !== undefined && schema.scale !== undefined && schema.scale > schema.precision) {
      builder.addError('NUMBER_SCALE_EXCEEDS_PRECISION', `scale (${schema.scale}) cannot exceed precision (${schema.precision})`, { precision: schema.precision, scale: schema.scale });
    }

    return builder.build();
  }

  validateConstraints(schema: NumberFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate conflicting sign constraints
    if (schema.positive && schema.negative) {
      builder.addError('NUMBER_CONFLICTING_SIGNS', 'Field cannot be both positive and negative');
    }

    // Validate positive constraint with range
    if (schema.positive && schema.max !== undefined && schema.max <= 0) {
      builder.addError('NUMBER_POSITIVE_WITH_NEGATIVE_MAX', `Field marked as positive but has max value <= 0 (${schema.max})`);
    }

    // Validate negative constraint with range
    if (schema.negative && schema.min !== undefined && schema.min >= 0) {
      builder.addError('NUMBER_NEGATIVE_WITH_POSITIVE_MIN', `Field marked as negative but has min value >= 0 (${schema.min})`);
    }

    // Validate integer constraint with precision
    if (schema.integer && schema.scale !== undefined && schema.scale > 0) {
      builder.addWarning('NUMBER_INTEGER_WITH_SCALE', 'Integer field should not have decimal scale');
    }

    return builder.build();
  }
}
