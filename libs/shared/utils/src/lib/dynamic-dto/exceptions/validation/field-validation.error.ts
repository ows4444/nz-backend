import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { FieldTypeValue } from '../../core/types/field.types';
import type { ValidationErrorContext, ValidationErrorSuggestion } from './base-validation.error';
import { BaseValidationError } from './base-validation.error';

export class FieldTypeValidationError extends BaseValidationError {
  constructor(fieldName: string, expectedType: FieldTypeValue, actualType: unknown, context?: ValidationErrorContext) {
    const message = `Field '${fieldName}' expected type '${expectedType}' but received '${typeof actualType}'`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: `Ensure field '${fieldName}' has type '${expectedType}'`,
        action: `Update field type to ${expectedType}`,
      },
      {
        type: 'documentation',
        message: 'Check field type documentation',
        url: '/docs/field-types',
      },
    ];

    super('FIELD_TYPE_MISMATCH', message, ValidationSeverity.error, { ...context, fieldPath: fieldName }, suggestions, { expectedType, actualType: typeof actualType, fieldName });
  }
}

export class FieldRequiredValidationError extends BaseValidationError {
  constructor(fieldName: string, context?: ValidationErrorContext) {
    const message = `Required field '${fieldName}' is missing`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: `Provide a value for required field '${fieldName}'`,
        action: `Set ${fieldName}`,
      },
      {
        type: 'alternative',
        message: 'Make field optional if it should not be required',
        action: 'Update schema to make field optional',
      },
    ];

    super('FIELD_REQUIRED', message, ValidationSeverity.error, { ...context, fieldPath: fieldName }, suggestions, { fieldName });
  }
}

export class FieldConstraintValidationError extends BaseValidationError {
  constructor(fieldName: string, constraintType: string, constraintValue: unknown, actualValue: unknown, context?: ValidationErrorContext) {
    const message = `Field '${fieldName}' violates ${constraintType} constraint: expected ${String(constraintValue)}, got ${String(actualValue)}`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: `Adjust field '${fieldName}' to meet ${constraintType} constraint`,
        action: `Set value to satisfy ${constraintType}: ${String(constraintValue)}`,
      },
    ];

    super('FIELD_CONSTRAINT_VIOLATION', message, ValidationSeverity.error, { ...context, fieldPath: fieldName }, suggestions, { fieldName, constraintType, constraintValue, actualValue });
  }
}

export class FieldPermissionValidationError extends BaseValidationError {
  constructor(fieldName: string, requiredPermissions: string[], userRoles: string[], operation: string, context?: ValidationErrorContext) {
    const message = `Insufficient permissions to ${operation} field '${fieldName}'. Required: [${requiredPermissions.join(', ')}], User has: [${userRoles.join(', ')}]`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: 'Contact administrator to request appropriate permissions',
        action: `Request permissions: ${requiredPermissions.join(', ')}`,
      },
      {
        type: 'alternative',
        message: 'Use a different operation that you have permissions for',
      },
    ];

    super('FIELD_PERMISSION_DENIED', message, ValidationSeverity.error, { ...context, fieldPath: fieldName, userRoles }, suggestions, { fieldName, requiredPermissions, userRoles, operation });
  }
}

export class FieldDeprecationValidationError extends BaseValidationError {
  constructor(
    fieldName: string,
    deprecationInfo: {
      since?: string;
      reason?: string;
      replacedBy?: string;
      removeInVersion?: string;
      migrationGuide?: string;
    },
    context?: ValidationErrorContext,
  ) {
    const message = `Field '${fieldName}' is deprecated${deprecationInfo.since ? ` since ${deprecationInfo.since}` : ''}`;

    const suggestions: ValidationErrorSuggestion[] = [];

    if (deprecationInfo.replacedBy) {
      suggestions.push({
        type: 'fix',
        message: `Use '${deprecationInfo.replacedBy}' instead of '${fieldName}'`,
        action: `Replace ${fieldName} with ${deprecationInfo.replacedBy}`,
      });
    }

    if (deprecationInfo.migrationGuide) {
      suggestions.push({
        type: 'documentation',
        message: 'Follow migration guide',
        action: deprecationInfo.migrationGuide,
      });
    }

    if (deprecationInfo.removeInVersion) {
      suggestions.push({
        type: 'fix',
        message: `Update before version ${deprecationInfo.removeInVersion}`,
        action: `Field will be removed in version ${deprecationInfo.removeInVersion}`,
      });
    }

    const severity = deprecationInfo.removeInVersion ? ValidationSeverity.error : ValidationSeverity.warning;

    super('FIELD_DEPRECATED', message, severity, { ...context, fieldPath: fieldName }, suggestions, { fieldName, ...deprecationInfo });
  }
}

export class FieldSecurityValidationError extends BaseValidationError {
  constructor(fieldName: string, securityIssue: 'SENSITIVE_NOT_ENCRYPTED' | 'PII_NO_PERMISSIONS' | 'UNSAFE_EXPOSURE', context?: ValidationErrorContext) {
    let message: string;
    let suggestions: ValidationErrorSuggestion[] = [];

    switch (securityIssue) {
      case 'SENSITIVE_NOT_ENCRYPTED':
        message = `Field '${fieldName}' contains sensitive data but is not encrypted`;
        suggestions = [
          {
            type: 'fix',
            message: 'Enable encryption for sensitive field',
            action: 'Set encrypted: true in field schema',
          },
          {
            type: 'alternative',
            message: 'Remove sensitive metadata if encryption is not needed',
          },
        ];
        break;
      case 'PII_NO_PERMISSIONS':
        message = `Field '${fieldName}' contains PII but has no access permissions defined`;
        suggestions = [
          {
            type: 'fix',
            message: 'Define access permissions for PII field',
            action: 'Add permissions object to field schema',
          },
        ];
        break;
      case 'UNSAFE_EXPOSURE':
        message = `Field '${fieldName}' may expose sensitive information`;
        suggestions = [
          {
            type: 'fix',
            message: 'Review field exposure settings',
            action: 'Check expose/exclude field properties',
          },
        ];
        break;
    }

    super(securityIssue, message, ValidationSeverity.error, { ...context, fieldPath: fieldName }, suggestions, { fieldName, securityIssue });
  }
}
