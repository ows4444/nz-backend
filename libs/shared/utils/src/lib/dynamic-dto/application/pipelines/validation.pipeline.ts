import { Injectable, Logger } from '@nestjs/common';
import { BaseSchemaValidator } from '../../core/abstractions/base-schema-validator.abstract';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { SchemaValidationPipeline } from './schema-validation.pipeline';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { ValidationResultMerger } from '../../core/utils/validation-result-merger';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { FieldValidatorRegistry } from '../../infrastructure/registries/field-validator.registry';
import { ValidationErrorService } from '../../exceptions/validation';

@Injectable()
export class ValidationPipeline {
  private readonly logger = new Logger(ValidationPipeline.name);

  constructor(
    private readonly schemaValidator: BaseSchemaValidator,
    private readonly schemaValidationPipeline: SchemaValidationPipeline,
    private readonly fieldValidatorRegistry: FieldValidatorRegistry,
    private readonly validationErrorService: ValidationErrorService,
  ) {}

  validate(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];

    try {
      this.logger.debug(`Starting validation for schema: ${schema.name}`);

      // 1. Enhanced schema validation pipeline
      const enhancedResult = this.schemaValidationPipeline.execute(schema);
      results.push(enhancedResult);

      // 2. Base schema validation with enhanced validateFieldSchema
      const baseResult = this.schemaValidator.validate(schema.properties, undefined, schema.name);
      results.push(baseResult);

      // 3. Individual field validation using registry
      const fieldValidationResult = this.validateFieldsWithRegistry(schema, context);
      results.push(fieldValidationResult);

      // 4. Business rules validation
      const businessRulesResult = this.validateBusinessRules(schema);
      results.push(businessRulesResult);

      // 5. Cross-field validation
      const crossFieldResult = this.validateCrossFieldRules(schema);
      results.push(crossFieldResult);

      const finalResult = ValidationResultMerger.mergeResults(results);

      this.logger.debug(`Validation completed for schema: ${schema.name}. Valid: ${finalResult.isValid}`);
      return finalResult;
    } catch (error) {
      this.logger.error(`Validation failed for schema: ${schema.name}`, error);
      return {
        isValid: false,
        issues: [
          {
            message: `Validation pipeline failed: ${error.message}`,
            code: 'VALIDATION_PIPELINE_ERROR',
            severity: ValidationSeverity.error,
            fieldPath: schema.name,
            metadata: { error: error.message },
          },
        ],
        errors: [
          {
            message: `Validation pipeline failed: ${error.message}`,
            code: 'VALIDATION_PIPELINE_ERROR',
            severity: ValidationSeverity.error,
            fieldPath: schema.name,
            metadata: { error: error.message },
          },
        ],
        warnings: [],
        infos: [],
      };
    }
  }

  private validateFieldsWithRegistry(schema: DynamicSchemaEntity, context?: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];

    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      const fieldContext: ValidationContext = {
        fieldPath: fieldName,
        depth: 0,
        parentType: 'schema',
        schemaName: schema.name,
        userRoles: context?.userRoles,
        data: context?.data,
      };

      const result = this.fieldValidatorRegistry.validateField(fieldSchema, fieldContext);
      results.push(result);
    }

    return ValidationResultMerger.mergeResults(results);
  }

  private validateBusinessRules(schema: DynamicSchemaEntity): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Enhanced business rules validation

    // Rule 1: Required fields must exist and have valid types
    for (const requiredField of schema.getRequiredFields()) {
      if (!schema.hasField(requiredField)) {
        issues.push({
          message: `Required field '${requiredField}' is missing in schema`,
          code: 'MISSING_REQUIRED_FIELD',
          severity: ValidationSeverity.error,
          fieldPath: requiredField,
        });
      }
    }

    // Rule 2: Schema versioning consistency
    if (schema.version) {
      const versionPattern = /^\d+\.\d+\.\d+$/;
      if (!versionPattern.test(schema.version.toString())) {
        issues.push({
          message: `Schema version '${schema.version.toString()}' must follow semantic versioning (x.y.z)`,
          code: 'INVALID_SCHEMA_VERSION',
          severity: ValidationSeverity.warning,
          fieldPath: 'version',
          metadata: { version: schema.version.toString() },
        });
      }
    }

    // Rule 3: Metadata consistency
    if (schema.metadata && Object.keys(schema.metadata).length === 0) {
      issues.push({
        message: 'Schema has empty metadata object',
        code: 'EMPTY_SCHEMA_METADATA',
        severity: ValidationSeverity.info,
        fieldPath: 'metadata',
      });
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  private validateCrossFieldRules(schema: DynamicSchemaEntity): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Cross-field validation rules
    const fieldEntries = Object.entries(schema.properties);

    // Rule 1: Check for conflicting field configurations
    for (const [fieldName, fieldSchema] of fieldEntries) {
      // Check if field has both exclude and expose set
      if (fieldSchema.exclude && fieldSchema.expose) {
        issues.push({
          message: `Field '${fieldName}' cannot have both 'exclude' and 'expose' set to true`,
          code: 'CONFLICTING_FIELD_VISIBILITY',
          severity: ValidationSeverity.error,
          fieldPath: fieldName,
        });
      }
    }

    // Rule 2: Check for dependency validation
    for (const [fieldName, fieldSchema] of fieldEntries) {
      if (fieldSchema.conditionalValidation) {
        for (const condition of fieldSchema.conditionalValidation) {
          const dependentField = condition.condition.field;
          if (!schema.hasField(dependentField)) {
            issues.push({
              message: `Field '${fieldName}' has conditional validation depending on non-existent field '${dependentField}'`,
              code: 'MISSING_DEPENDENT_FIELD',
              severity: ValidationSeverity.error,
              fieldPath: fieldName,
              metadata: { dependentField },
            });
          }
        }
      }
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }
}
