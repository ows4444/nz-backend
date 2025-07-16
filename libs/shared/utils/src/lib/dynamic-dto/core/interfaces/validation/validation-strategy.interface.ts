import type { FieldTypeValue } from '../../types/field.types';
import type { BaseFieldSchema } from '../schema';
import type { ValidationContext } from './validation-context.interface';
import type { ValidationResult } from './validation-result.interface';

export interface IValidationStrategy {
  readonly name: string;
  readonly priority: number;
  canHandle(fieldType: FieldTypeValue, context: ValidationContext): boolean;
  validate<T extends BaseFieldSchema>(schema: T, context: ValidationContext): Promise<ValidationResult>;
}
