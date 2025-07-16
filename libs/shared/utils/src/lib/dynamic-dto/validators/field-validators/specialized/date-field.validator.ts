import { Injectable } from '@nestjs/common';
import { BaseFieldValidator } from '../../../core/abstractions/base-field-validator.abstract';
import { DateFieldSchema } from '../../../core/interfaces/schema/specialized-primitives/date-field.schema';
import { BaseFieldSchema } from '../../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../../core/interfaces/validation';
import { ValidationResultBuilder } from '../../../core/utils/validation-result.builder';
import { FieldType } from '../../../core/types/field.types';

@Injectable()
export class DateFieldValidator extends BaseFieldValidator<DateFieldSchema> {
  readonly supportedType = FieldType.date;
  readonly priority = 100;
  readonly name = 'DateFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is DateFieldSchema {
    return schema.type === FieldType.date;
  }

  validateStructure(schema: DateFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate date range
    if (schema.min && schema.max) {
      const minDate = new Date(schema.min);
      const maxDate = new Date(schema.max);

      if (minDate >= maxDate) {
        builder.addError('DATE_INVALID_RANGE', `min date (${String(schema.min)}) must be before max date (${String(schema.max)})`);
      }
    }

    // Validate timezone
    if (schema.timezone && schema.timezone !== 'auto' && schema.timezone !== 'utc' && schema.timezone !== 'local') {
      if (!this.isValidTimezone(schema.timezone)) {
        builder.addError('DATE_INVALID_TIMEZONE', `Invalid timezone: ${schema.timezone}`);
      }
    }

    return builder.build();
  }

  validateConstraints(schema: DateFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    // Validate future/past constraints
    if (schema.validateFuture && schema.validatePast) {
      builder.addError('DATE_CONFLICTING_CONSTRAINTS', 'Cannot validate both future and past simultaneously');
    }

    // Validate exclude/include dates
    if (schema.excludeDates && schema.includeDates) {
      const excludeSet = new Set(schema.excludeDates.map((d) => new Date(d).toISOString()));
      const conflicts = schema.includeDates.filter((d) => excludeSet.has(new Date(d).toISOString()));

      if (conflicts.length > 0) {
        builder.addWarning('DATE_CONFLICTING_INCLUDE_EXCLUDE', 'Some dates appear in both include and exclude lists');
      }
    }

    return builder.build();
  }

  private isValidTimezone(timezone: string): boolean {
    try {
      new Intl.DateTimeFormat('en', { timeZone: timezone });
      return true;
    } catch {
      return false;
    }
  }
}
