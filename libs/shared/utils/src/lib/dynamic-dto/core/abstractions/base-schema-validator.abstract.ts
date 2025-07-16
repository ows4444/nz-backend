import type { FieldSchema } from '../interfaces/schema';
import type { ValidationContext, ValidationResult } from '../interfaces/validation';
import type { ValidationIssue } from '../interfaces/validation/validation-issue.interface';
import { FieldType } from '../types/field.types';
import { ValidationSeverity } from '../enums/validation.enums';
import { ValidationResultMerger } from '../utils/validation-result-merger';

export abstract class BaseSchemaValidator {
  abstract validate(schema: Record<string, FieldSchema>, data?: unknown, context?: string): ValidationResult;

  protected validateFieldSchema(fieldName: string, schema: FieldSchema, context?: ValidationContext): ValidationResult {
    const fieldPath = context?.fieldPath ?? fieldName;
    const results: ValidationResult[] = [];

    // Core field validation
    results.push(this.validateFieldCore(fieldName, schema, fieldPath));

    // Enhanced validation methods
    results.push(this.validateDeprecatedField(fieldName, schema));
    results.push(this.validatePermissions(fieldName, schema, context?.userRoles ? [...context.userRoles] : []));
    results.push(this.validateFieldConstraints(fieldName, schema, fieldPath));
    results.push(this.validateFieldSecurity(fieldName, schema, fieldPath));

    return ValidationResultMerger.mergeResults(results);
  }

  private validateFieldCore(fieldName: string, schema: FieldSchema, fieldPath: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (!schema.type) {
      issues.push({
        message: `Field '${fieldName}' is missing required 'type' property`,
        fieldPath,
        code: 'MISSING_TYPE',
        severity: ValidationSeverity.error,
      });
    }

    if (schema.type && !Object.values(FieldType).includes(schema.type)) {
      issues.push({
        message: `Field '${fieldName}' has an invalid 'type': ${schema.type}`,
        fieldPath,
        code: 'INVALID_TYPE',
        severity: ValidationSeverity.error,
        value: schema.type,
      });
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath,
      metadata: schema.metadata,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  private validateFieldConstraints(fieldName: string, schema: FieldSchema, fieldPath: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Type-safe validation for schema properties
    const hasDefaultValue = 'default' in schema && schema.default !== undefined;
    const hasRequiredValidation = schema.conditionalValidation?.some((cv) => cv.validationRules.some((rule) => rule.type === 'required'));
    const isReadonly = schema.readonly;

    // Validate required constraint consistency
    if (hasRequiredValidation && hasDefaultValue) {
      issues.push({
        message: `Field '${fieldName}' is marked as required but has a default value`,
        fieldPath,
        code: 'REQUIRED_WITH_DEFAULT',
        severity: ValidationSeverity.warning,
        metadata: { defaultValue: schema.default },
      });
    }

    // Validate readonly with required
    if (isReadonly && hasRequiredValidation) {
      issues.push({
        message: `Field '${fieldName}' cannot be both readonly and required`,
        fieldPath,
        code: 'READONLY_REQUIRED_CONFLICT',
        severity: ValidationSeverity.error,
      });
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  private validateFieldSecurity(fieldName: string, schema: FieldSchema, fieldPath: string): ValidationResult {
    const issues: ValidationIssue[] = [];

    // Validate sensitive data handling (only if encryption property exists)
    const hasEncryption = 'encrypted' in schema ? (schema as { encrypted?: boolean }).encrypted : false;
    if (schema.metadata?.sensitive && !hasEncryption) {
      issues.push({
        message: `Field '${fieldName}' is marked as sensitive but not encrypted`,
        fieldPath,
        code: 'SENSITIVE_NOT_ENCRYPTED',
        severity: ValidationSeverity.warning,
      });
    }

    // Validate PII compliance
    if (schema.metadata?.pii && !schema.permissions) {
      issues.push({
        message: `Field '${fieldName}' contains PII but has no access permissions defined`,
        fieldPath,
        code: 'PII_NO_PERMISSIONS',
        severity: ValidationSeverity.error,
      });
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  protected validateDeprecatedField(fieldName: string, schema: FieldSchema): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (schema.deprecated) {
      // Enhanced deprecation validation
      const deprecationSince = schema.deprecated.since;
      const currentVersion = process.env.APP_VERSION ?? '1.0.0';

      issues.push({
        message: `Field '${fieldName}' is deprecated${deprecationSince ? ` since ${deprecationSince}` : ''}`,
        fieldPath: fieldName,
        code: 'DEPRECATED_FIELD',
        severity: ValidationSeverity.warning,
        metadata: {
          since: deprecationSince,
          currentVersion,
          replacedBy: schema.deprecated.replacedBy,
        },
      });

      if (schema.deprecated.replacedBy) {
        issues.push({
          message: `Field '${fieldName}' should be replaced by '${schema.deprecated.replacedBy}'`,
          fieldPath: fieldName,
          code: 'FIELD_REPLACEMENT_AVAILABLE',
          severity: ValidationSeverity.warning,
          metadata: { replacedBy: schema.deprecated.replacedBy },
        });
      }

      if (schema.deprecated.reason) {
        issues.push({
          message: `Field '${fieldName}' deprecation reason: ${schema.deprecated.reason}`,
          fieldPath: fieldName,
          code: 'DEPRECATION_REASON',
          severity: ValidationSeverity.info,
          metadata: { reason: schema.deprecated.reason },
        });
      }

      if (schema.deprecated.removeInVersion) {
        issues.push({
          message: `Field '${fieldName}' will be removed in version ${schema.deprecated.removeInVersion}`,
          fieldPath: fieldName,
          code: 'REMOVAL_NOTICE',
          severity: ValidationSeverity.info,
          metadata: { removeInVersion: schema.deprecated.removeInVersion },
        });

        // Add error if removal version has passed
        if (this.isVersionPassed(currentVersion, schema.deprecated.removeInVersion)) {
          issues.push({
            message: `Field '${fieldName}' should have been removed in version ${schema.deprecated.removeInVersion}`,
            fieldPath: fieldName,
            code: 'REMOVAL_VERSION_PASSED',
            severity: ValidationSeverity.error,
            metadata: {
              removeInVersion: schema.deprecated.removeInVersion,
              currentVersion,
            },
          });
        }
      }

      if (schema.deprecated.migrationGuide) {
        issues.push({
          message: `Migration guide for '${fieldName}': ${schema.deprecated.migrationGuide}`,
          fieldPath: fieldName,
          code: 'MIGRATION_GUIDE',
          severity: ValidationSeverity.info,
          metadata: { migrationGuide: schema.deprecated.migrationGuide },
        });
      }
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath: fieldName,
      metadata: schema.metadata,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  private isVersionPassed(currentVersion: string, targetVersion: string): boolean {
    const parseVersion = (version: string) => {
      return version.split('.').map((v) => parseInt(v.replace(/\D/g, ''), 10) || 0);
    };

    const current = parseVersion(currentVersion);
    const target = parseVersion(targetVersion);

    for (let i = 0; i < Math.max(current.length, target.length); i++) {
      const currentPart = current[i] || 0;
      const targetPart = target[i] || 0;

      if (currentPart > targetPart) return true;
      if (currentPart < targetPart) return false;
    }

    return false; // Equal versions
  }

  protected validatePermissions(fieldName: string, schema: FieldSchema, userRoles: string[] = []): ValidationResult {
    const issues: ValidationIssue[] = [];

    if (schema.permissions) {
      // Validate permission structure
      const permissions = schema.permissions;
      const allRoles = [...(permissions.read ?? []), ...(permissions.write ?? []), ...(permissions.create ?? []), ...(permissions.update ?? []), ...(permissions.delete ?? [])];

      if (allRoles.length === 0) {
        issues.push({
          message: `Field '${fieldName}' has permissions object but no roles defined`,
          fieldPath: fieldName,
          code: 'PERMISSIONS_EMPTY',
          severity: ValidationSeverity.warning,
        });
      }

      // Check for logical permission issues
      const writeRoles = new Set(permissions.write ?? []);
      const readRoles = new Set(permissions.read ?? []);

      // Write roles should imply read access
      const writeOnlyRoles = [...writeRoles].filter((role) => !readRoles.has(role));
      if (writeOnlyRoles.length > 0) {
        issues.push({
          message: `Field '${fieldName}' has write permissions without read permissions for roles: ${writeOnlyRoles.join(', ')}`,
          fieldPath: fieldName,
          code: 'PERMISSIONS_WRITE_WITHOUT_READ',
          severity: ValidationSeverity.warning,
          metadata: { roles: writeOnlyRoles },
        });
      }

      // Validate user access if userRoles provided
      if (userRoles.length > 0) {
        const hasReadPermission = permissions.read?.some((role) => userRoles.includes(role));
        if (!hasReadPermission) {
          issues.push({
            message: `Insufficient permissions to access field '${fieldName}'`,
            fieldPath: fieldName,
            code: 'INSUFFICIENT_PERMISSIONS',
            severity: ValidationSeverity.error,
            metadata: {
              userRoles,
              requiredRoles: permissions.read,
            },
          });
        }
      }

      // Validate role naming conventions
      const invalidRoles = allRoles.filter((role) => !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(role));
      if (invalidRoles.length > 0) {
        issues.push({
          message: `Field '${fieldName}' has invalid role names: ${invalidRoles.join(', ')}`,
          fieldPath: fieldName,
          code: 'INVALID_ROLE_NAMES',
          severity: ValidationSeverity.warning,
          metadata: { invalidRoles },
        });
      }
    }

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath: fieldName,
      metadata: schema.metadata,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  protected validateSchemaIntegrity(schema: Record<string, FieldSchema>, context = ''): ValidationResult {
    const issues: ValidationIssue[] = [];
    const fieldNames = Object.keys(schema);

    // Check for circular references in object fields
    this.detectCircularReferences(schema, fieldNames, issues, context);

    // Validate field name conventions
    this.validateFieldNaming(fieldNames, issues, context);

    // Check for schema consistency
    this.validateSchemaConsistency(schema);

    return {
      isValid: !issues.some((issue) => issue.severity === ValidationSeverity.error),
      issues,
      fieldPath: context,
      errors: issues.filter((issue) => issue.severity === ValidationSeverity.error),
      warnings: issues.filter((issue) => issue.severity === ValidationSeverity.warning),
      infos: issues.filter((issue) => issue.severity === ValidationSeverity.info),
    };
  }

  private detectCircularReferences(schema: Record<string, FieldSchema>, fieldNames: string[], issues: ValidationIssue[], context: string): void {
    // Simplified circular reference detection
    // This could be enhanced with more sophisticated graph traversal
    const visited = new Set<string>();

    for (const fieldName of fieldNames) {
      if (schema[fieldName].type === FieldType.object && schema[fieldName].properties) {
        this.checkForSelfReference(fieldName, schema[fieldName], visited, issues, context);
      }
    }
  }

  private checkForSelfReference(fieldName: string, fieldSchema: FieldSchema, visited: Set<string>, issues: ValidationIssue[], context: string): void {
    if (visited.has(fieldName)) {
      issues.push({
        message: `Potential circular reference detected in field '${fieldName}'`,
        fieldPath: context ? `${context}.${fieldName}` : fieldName,
        code: 'CIRCULAR_REFERENCE',
        severity: ValidationSeverity.warning,
        metadata: { fieldName },
      });
      return;
    }

    visited.add(fieldName);
    // Additional logic for deep circular reference detection would go here
    visited.delete(fieldName);
  }

  private validateFieldNaming(fieldNames: string[], issues: ValidationIssue[], context: string): void {
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);

    if (duplicates.length > 0) {
      issues.push({
        message: `Duplicate field names found: ${duplicates.join(', ')}`,
        fieldPath: context,
        code: 'DUPLICATE_FIELD_NAMES',
        severity: ValidationSeverity.error,
        metadata: { duplicates },
      });
    }

    // Check naming conventions
    const invalidNames = fieldNames.filter((name) => !/^[a-zA-Z][a-zA-Z0-9_]*$/.test(name));
    if (invalidNames.length > 0) {
      issues.push({
        message: `Invalid field names (must start with letter, contain only alphanumeric and underscore): ${invalidNames.join(', ')}`,
        fieldPath: context,
        code: 'INVALID_FIELD_NAMES',
        severity: ValidationSeverity.warning,
        metadata: { invalidNames },
      });
    }
  }

  private validateSchemaConsistency(schema: Record<string, FieldSchema>): void {
    // Check for fields with same purpose but different configurations
    const fieldsByType = new Map<string, string[]>();

    Object.entries(schema).forEach(([name, fieldSchema]) => {
      const typeKey = fieldSchema.type;
      if (!fieldsByType.has(typeKey)) {
        fieldsByType.set(typeKey, []);
      }
      fieldsByType.get(typeKey)!.push(name);
    });

    // Additional consistency checks can be added here
  }
}
