import type { Provider } from '@nestjs/common';
import { StringFieldValidator } from '../../validators/field-validators/primitive/string-field.validator';
import { NumberFieldValidator } from '../../validators/field-validators/primitive/number-field.validator';
import { BooleanFieldValidator } from '../../validators/field-validators/primitive/boolean-field.validator';
import { ArrayFieldValidator } from '../../validators/field-validators/complex/array-field.validator';
import { ObjectFieldValidator } from '../../validators/field-validators/complex/object-field.validator';
import { DateFieldValidator } from '../../validators/field-validators/specialized/date-field.validator';

export function createFieldValidatorProviders(): Provider[] {
  return [
    // Primitive validators
    StringFieldValidator,
    NumberFieldValidator,
    BooleanFieldValidator,

    // Complex validators
    ArrayFieldValidator,
    ObjectFieldValidator,

    // Specialized validators
    DateFieldValidator,
  ];
}
