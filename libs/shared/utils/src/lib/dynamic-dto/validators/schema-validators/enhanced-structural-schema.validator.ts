import { Injectable } from '@nestjs/common';
import { BaseSchemaValidator } from '../../core/abstractions/base-schema-validator.abstract';
import { FieldSchema } from '../../core/interfaces/schema';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { FieldValidatorRegistry } from '../../infrastructure/registries/field-validator.registry';
import { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { ValidationResultMerger } from '../../core/utils/validation-result-merger';

@Injectable()
export class EnhancedStructuralSchemaValidator extends BaseSchemaValidator {
  constructor(private readonly fieldValidatorRegistry: FieldValidatorRegistry) {
    super();
  }

  validate(schema: Record<string, FieldSchema>, data?: unknown, context = ''): ValidationResult {
    return this.validateSchemaObject(schema, context, data);
  }

  private validateSchemaObject(schema: Record<string, FieldSchema>, context: string, data?: unknown): ValidationResult {
    const results: ValidationResult[] = [];

    // Enhanced schema structure validation with integrity checks
    results.push(this.validateSchemaStructure(schema, context));
    results.push(this.validateSchemaIntegrity(schema, context));

    // Validate individual fields using both BaseSchemaValidator and FieldValidatorRegistry
    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      const fieldPath = context ? `${context}.${fieldName}` : fieldName;
      const validationContext: ValidationContext = {
        fieldPath,
        depth: context.split('.').filter(Boolean).length,
        parentType: undefined,
        data,
      };

      // Use enhanced validateFieldSchema from BaseSchemaValidator
      const baseValidationResult = this.validateFieldSchema(fieldName, fieldSchema, validationContext);
      results.push(baseValidationResult);

      // Use field-specific validation from registry
      const registryResult = this.fieldValidatorRegistry.validateField(fieldSchema, validationContext);
      results.push(registryResult);
    }

    return ValidationResultMerger.mergeResults(results);
  }

  private validateSchemaStructure(schema: Record<string, FieldSchema>, context: string): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];
    const issues: ValidationIssue[] = [];

    if (!schema || typeof schema !== 'object') {
      errors.push({
        message: `Schema at ${context || 'root'} must be an object`,
        fieldPath: context,
        code: 'INVALID_SCHEMA_STRUCTURE',
        severity: 'error',
      });
      return { isValid: false, errors, infos, issues, warnings };
    }

    if (Object.keys(schema).length === 0) {
      warnings.push({
        message: `Schema at ${context || 'root'} is empty`,
        fieldPath: context,
        code: 'EMPTY_SCHEMA',
        severity: 'warning',
      });
    }

    return { isValid: errors.length === 0, errors, infos, issues, warnings };
  }

  public validateWithContext(schema: Record<string, FieldSchema>, validationContext: Partial<ValidationContext>): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];
    const infos: ValidationIssue[] = [];
    const issues: ValidationIssue[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(schema)) {
      const context: ValidationContext = {
        fieldPath: fieldName,
        depth: 0,
        ...validationContext,
      };

      const result = this.fieldValidatorRegistry.validateField(fieldSchema, context);
      if (result.errors) errors.push(...result.errors);
      if (result.warnings) warnings.push(...result.warnings);
      if (result.infos) infos.push(...result.infos);
      if (result.issues) issues.push(...result.issues);
    }

    return { isValid: errors.length === 0, errors, infos, issues, warnings };
  }
}
