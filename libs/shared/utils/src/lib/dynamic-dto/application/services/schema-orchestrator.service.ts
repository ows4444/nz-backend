import { Injectable } from '@nestjs/common';
import type { FieldSchema } from '../../core/interfaces/schema';
import type { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldValidatorRegistry } from '../../infrastructure/registries/field-validator.registry';
import { EnhancedStructuralSchemaValidator } from '../../validators/schema-validators/enhanced-structural-schema.validator';

@Injectable()
export class SchemaOrchestratorService {
  constructor(
    private readonly fieldValidatorRegistry: FieldValidatorRegistry,
    private readonly enhancedValidator: EnhancedStructuralSchemaValidator,
  ) {}

  validateSchema(schema: Record<string, FieldSchema>, context?: Partial<ValidationContext>): ValidationResult {
    if (context) {
      return this.enhancedValidator.validateWithContext(schema, context);
    }

    return this.enhancedValidator.validate(schema);
  }

  validateField(schema: FieldSchema, context: ValidationContext): ValidationResult {
    return this.fieldValidatorRegistry.validateField(schema, context);
  }

  validateSchemaWithUserRoles(schema: Record<string, FieldSchema>, userRoles?: string[]): ValidationResult {
    const context: Partial<ValidationContext> = {
      userRoles,
    };

    return this.validateSchema(schema, context);
  }
}
