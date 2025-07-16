import { ValidationSeverity } from '../enums/validation.enums';
import type { BaseFieldSchema, ConditionalValidation, DisplayHints, FieldPermissions } from '../interfaces/schema';
import type { ValidationContext, ValidationResult } from '../interfaces/validation';
import type { ValidationIssue } from '../interfaces/validation/validation-issue.interface';
import type { FieldTypeValue } from '../types/field.types';

export abstract class BaseFieldValidator<T extends BaseFieldSchema = BaseFieldSchema> {
  abstract readonly supportedType: FieldTypeValue;
  abstract readonly priority: number;
  abstract readonly name: string;

  // Type guards
  abstract canValidate(schema: BaseFieldSchema): schema is T;

  // Core validation methods
  abstract validateStructure(schema: T, context: ValidationContext): ValidationResult;
  abstract validateConstraints(schema: T, context: ValidationContext): ValidationResult;

  // Optional specialized validation
  protected validateSecurity?(schema: T, context: ValidationContext): ValidationResult;
  protected validatePerformance?(schema: T, context: ValidationContext): ValidationResult;
  protected validateAccessibility?(schema: T, context: ValidationContext): ValidationResult;

  // Main validation orchestrator
  public validate(schema: T, context: ValidationContext): ValidationResult {
    const results: ValidationResult[] = [];

    // Structure validation (required)
    results.push(this.validateStructure(schema, context));

    // Constraint validation (required)
    results.push(this.validateConstraints(schema, context));

    // Common validations
    results.push(this.validateCommonProperties(schema, context));

    // Optional specialized validations
    if (this.validateSecurity) {
      results.push(this.validateSecurity(schema, context));
    }

    if (this.validatePerformance) {
      results.push(this.validatePerformance(schema, context));
    }

    if (this.validateAccessibility) {
      results.push(this.validateAccessibility(schema, context));
    }

    return this.mergeResults(results);
  }

  protected mergeResults(results: readonly ValidationResult[]): ValidationResult {
    const allIssues = results.flatMap((r) => r.issues);

    return {
      isValid: allIssues.every((issue) => issue.severity !== ValidationSeverity.error),
      issues: allIssues,
      fieldPath: results[0]?.fieldPath,
      errors: allIssues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: allIssues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: allIssues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  protected validateCommonProperties(schema: T, context: ValidationContext): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Deprecation validation
    if (schema.deprecated) {
      issues.push(...this.validateDeprecation(schema, context));
    }

    // Permissions validation
    if (schema.permissions) {
      issues.push(...this.validatePermissions(schema.permissions, context));
    }

    // Display hints validation
    if (schema.displayHints) {
      issues.push(...this.validateDisplayHints(schema.displayHints, context));
    }

    // Conditional validation
    if (schema.conditionalValidation?.length) {
      issues.push(...this.validateConditionalRules(schema.conditionalValidation, context));
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath: context.fieldPath,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  protected validateDeprecation(schema: T, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (schema.deprecated) {
      issues.push({
        severity: ValidationSeverity.warning,
        code: 'FIELD_DEPRECATED',
        message: `Field '${context.fieldPath}' is deprecated`,
        fieldPath: context.fieldPath,
      });
    }

    return issues;
  }

  protected validatePermissions(permissions: FieldPermissions, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    const allRoles = [...(permissions.read ?? []), ...(permissions.write ?? []), ...(permissions.create ?? []), ...(permissions.update ?? []), ...(permissions.delete ?? [])];

    if (allRoles.length === 0) {
      issues.push({
        severity: ValidationSeverity.warning,
        code: 'PERMISSIONS_EMPTY',
        message: `Field '${context.fieldPath}' has permissions object but no roles defined`,
        fieldPath: context.fieldPath,
      });
    }

    // Check for invalid role combinations
    const writeRoles = new Set(permissions.write ?? []);
    const readRoles = new Set(permissions.read ?? []);

    // Write roles should imply read access
    const writeOnlyRoles = [...writeRoles].filter((role) => !readRoles.has(role));
    if (writeOnlyRoles.length > 0) {
      issues.push({
        severity: ValidationSeverity.warning,
        code: 'PERMISSIONS_WRITE_WITHOUT_READ',
        message: `Field '${context.fieldPath}' has write permissions without read permissions for roles: ${writeOnlyRoles.join(', ')}`,
        fieldPath: context.fieldPath,
        metadata: { roles: writeOnlyRoles },
      });
    }

    return issues;
  }

  protected validateDisplayHints(hints: DisplayHints, context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    if (hints.order !== undefined && (hints.order < 0 || !Number.isInteger(hints.order))) {
      issues.push({
        severity: ValidationSeverity.error,
        code: 'DISPLAY_INVALID_ORDER',
        message: `Display order for field '${context.fieldPath}' must be a non-negative integer`,
        fieldPath: context.fieldPath,
        value: hints.order,
      });
    }

    if (hints.validation?.debounceMs !== undefined && hints.validation.debounceMs < 0) {
      issues.push({
        severity: ValidationSeverity.error,
        code: 'DISPLAY_INVALID_DEBOUNCE',
        message: `Validation debounce for field '${context.fieldPath}' must be non-negative`,
        fieldPath: context.fieldPath,
        value: hints.validation.debounceMs,
      });
    }

    return issues;
  }

  protected validateConditionalRules(rules: readonly ConditionalValidation[], context: ValidationContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];

    for (const [index, rule] of rules.entries()) {
      const rulePath = `${context.fieldPath}.conditionalValidation[${index}]`;

      if (!rule.condition.field) {
        issues.push({
          severity: ValidationSeverity.error,
          code: 'CONDITIONAL_MISSING_FIELD',
          message: `Conditional validation rule at ${rulePath} must specify a field`,
          fieldPath: rulePath,
        });
      }

      if (!rule.validationRules?.length) {
        issues.push({
          severity: ValidationSeverity.warning,
          code: 'CONDITIONAL_EMPTY_RULES',
          message: `Conditional validation rule at ${rulePath} has no validation rules`,
          fieldPath: rulePath,
        });
      }
    }

    return issues;
  }

  protected createError(code: string, message: string, context: ValidationContext, metadata?: Record<string, unknown>): ValidationIssue {
    return {
      severity: ValidationSeverity.error,
      code,
      message,
      fieldPath: context.fieldPath,
      metadata,
    };
  }

  protected createWarning(code: string, message: string, context: ValidationContext, metadata?: Record<string, unknown>): ValidationIssue {
    return {
      severity: ValidationSeverity.warning,
      code,
      message,
      fieldPath: context.fieldPath,
      metadata,
    };
  }

  protected createInfo(code: string, message: string, context: ValidationContext, metadata?: Record<string, unknown>): ValidationIssue {
    return {
      severity: ValidationSeverity.info,
      code,
      message,
      fieldPath: context.fieldPath,
      metadata,
    };
  }
}
