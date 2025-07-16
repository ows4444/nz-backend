import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { FieldType } from '../../../core/types/field.types';
import { BaseFieldSchema } from '../../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationResultBuilder } from '../../../core/utils/validation-result.builder';
import { BooleanFieldSchema } from '../../../core/interfaces/schema/primitive/boolean-field.schema';
import { Injectable } from '@nestjs/common';

@Injectable()
export class BooleanFieldValidator extends BaseFieldValidator<BooleanFieldSchema> {
  readonly supportedType = FieldType.boolean;
  readonly priority = 100;
  readonly name = 'BooleanFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is BooleanFieldSchema {
    return schema.type === FieldType.boolean;
  }

  validateStructure(schema: BooleanFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    if (schema.trueValues && !Array.isArray(schema.trueValues)) {
      builder.addError('BOOLEAN_INVALID_TRUE_VALUES', 'trueValues must be an array');
    }

    if (schema.falseValues && !Array.isArray(schema.falseValues)) {
      builder.addError('BOOLEAN_INVALID_FALSE_VALUES', 'falseValues must be an array');
    }

    return builder.build();
  }

  validateConstraints(schema: BooleanFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Check for conflicting true/false values
    if (schema.trueValues && schema.falseValues) {
      const falseSet = new Set(schema.falseValues);

      const conflicts = schema.trueValues.filter((v) => falseSet.has(v));
      if (conflicts.length > 0) {
        builder.addError('BOOLEAN_CONFLICTING_VALUES', `Values appear in both trueValues and falseValues: ${conflicts.join(', ')}`, conflicts);
      }
    }

    // Validate default value
    if (schema.default !== undefined && typeof schema.default !== 'boolean') {
      builder.addError('BOOLEAN_INVALID_DEFAULT', 'Default value must be a boolean', schema.default);
    }

    // Check for empty value arrays
    if (schema.trueValues && schema.trueValues.length === 0) {
      builder.addWarning('BOOLEAN_EMPTY_TRUE_VALUES', 'trueValues array is empty');
    }

    if (schema.falseValues && schema.falseValues.length === 0) {
      builder.addWarning('BOOLEAN_EMPTY_FALSE_VALUES', 'falseValues array is empty');
    }

    return builder.build();
  }
}
