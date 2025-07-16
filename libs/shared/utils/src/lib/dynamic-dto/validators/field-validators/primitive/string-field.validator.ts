import { AutoGenerationType, StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { FieldType } from '../../../core/types/field.types';
import { BaseFieldSchema } from '../../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationResultBuilder } from '../../../core/utils/validation-result.builder';
import { StringFormat } from '../../../core/enums/string.enums';
import { Injectable } from '@nestjs/common';

@Injectable()
export class StringFieldValidator extends BaseFieldValidator<StringFieldSchema> {
  readonly supportedType = FieldType.string;
  readonly priority = 100;
  readonly name = 'StringFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string;
  }

  validateStructure(schema: StringFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate length constraints
    if (schema.minLength !== undefined && schema.maxLength !== undefined) {
      if (schema.minLength > schema.maxLength) {
        builder.addError('STRING_INVALID_LENGTH_RANGE', `minLength (${schema.minLength}) cannot be greater than maxLength (${schema.maxLength})`, {
          minLength: schema.minLength,
          maxLength: schema.maxLength,
        });
      }
    }

    if (schema.minLength !== undefined && schema.minLength < 0) {
      builder.addError('STRING_INVALID_MIN_LENGTH', 'minLength must be non-negative', schema.minLength);
    }

    if (schema.exactLength !== undefined && schema.exactLength < 0) {
      builder.addError('STRING_INVALID_EXACT_LENGTH', 'exactLength must be non-negative', schema.exactLength);
    }

    // Validate pattern
    if (schema.pattern) {
      try {
        new RegExp(schema.pattern);
      } catch (error: unknown) {
        if (error instanceof SyntaxError) {
          builder.addError('STRING_INVALID_PATTERN', `Invalid regex pattern: ${error.message}`, schema.pattern);
        }
      }
    }

    if (schema.antiPattern) {
      try {
        if (typeof schema.antiPattern === 'string') {
          new RegExp(schema.antiPattern);
        }
      } catch (error: unknown) {
        if (error instanceof SyntaxError) {
          builder.addError('STRING_INVALID_ANTI_PATTERN', `Invalid anti-pattern regex: ${error.message}`, schema.antiPattern);
        }
      }
    }

    // Validate format
    if (schema.format && !Object.values(StringFormat).includes(schema.format)) {
      builder.addError('STRING_INVALID_FORMAT', `Invalid string format: ${schema.format}`, schema.format);
    }

    // Validate auto-generation
    if (schema.autoGenerate && !Object.values(AutoGenerationType).includes(schema.autoGenerate)) {
      builder.addError('STRING_INVALID_AUTO_GENERATE', `Invalid auto-generation type: ${schema.autoGenerate}`, schema.autoGenerate);
    }

    return builder.build();
  }

  validateConstraints(schema: StringFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate conflicting constraints
    if (schema.exactLength !== undefined && (schema.minLength !== undefined || schema.maxLength !== undefined)) {
      builder.addWarning('STRING_CONFLICTING_LENGTH_CONSTRAINTS', 'exactLength conflicts with minLength/maxLength constraints');
    }

    // Validate auto-generation with other constraints
    if (schema.autoGenerate && schema.default !== undefined) {
      builder.addWarning('STRING_AUTO_GENERATE_WITH_DEFAULT', 'autoGenerate specified along with default value; autoGenerate will take precedence');
    }

    // Validate trimming with exact length
    if (schema.trimming && schema.exactLength !== undefined) {
      builder.addWarning('STRING_TRIMMING_WITH_EXACT_LENGTH', 'Trimming may conflict with exactLength constraint');
    }

    return builder.build();
  }

  protected validateSecurity(schema: StringFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Check for potentially sensitive formats without security config
    const sensitiveFormats: StringFormat[] = [StringFormat.password, StringFormat.credit_card];
    if (schema.format && sensitiveFormats.includes(schema.format) && !schema.security) {
      builder.addWarning('STRING_SENSITIVE_WITHOUT_SECURITY', `Field with sensitive format '${schema.format}' should have security configuration`);
    }

    // // Validate XSS protection for HTML content
    // if (schema.format === StringFormat.HTML && !schema.sanitization?.xss) {
    //   builder.addWarning('STRING_HTML_WITHOUT_XSS_PROTECTION', 'HTML content should have XSS protection enabled');
    // }

    return builder.build();
  }
}
