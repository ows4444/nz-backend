import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { ValidationErrorContext, ValidationErrorSuggestion } from './base-validation.error';
import { BaseValidationError } from './base-validation.error';

export class SchemaStructureValidationError extends BaseValidationError {
  constructor(schemaName: string, structureIssue: 'EMPTY_SCHEMA' | 'INVALID_STRUCTURE' | 'MISSING_PROPERTIES', context?: ValidationErrorContext) {
    let message: string;
    let suggestions: ValidationErrorSuggestion[] = [];
    let severity: ValidationSeverity = ValidationSeverity.error;

    switch (structureIssue) {
      case 'EMPTY_SCHEMA':
        message = `Schema '${schemaName}' is empty`;
        severity = ValidationSeverity.warning;
        suggestions = [
          {
            type: 'fix',
            message: 'Add field definitions to the schema',
            action: 'Define at least one field in schema properties',
          },
        ];
        break;
      case 'INVALID_STRUCTURE':
        message = `Schema '${schemaName}' has invalid structure`;
        suggestions = [
          {
            type: 'fix',
            message: 'Ensure schema follows the correct format',
            action: 'Review schema structure requirements',
          },
          {
            type: 'documentation',
            message: 'Check schema documentation',
            url: '/docs/schema-structure',
          },
        ];
        break;
      case 'MISSING_PROPERTIES':
        message = `Schema '${schemaName}' is missing required properties`;
        suggestions = [
          {
            type: 'fix',
            message: 'Add required properties to schema',
            action: 'Include properties object in schema',
          },
        ];
        break;
    }

    super(structureIssue, message, severity, { ...context, schemaName }, suggestions, { schemaName, structureIssue });
  }
}

export class SchemaVersionValidationError extends BaseValidationError {
  constructor(schemaName: string, version: string, versionIssue: 'INVALID_FORMAT' | 'VERSION_CONFLICT' | 'UNSUPPORTED_VERSION', context?: ValidationErrorContext) {
    let message: string;
    let suggestions: ValidationErrorSuggestion[] = [];

    switch (versionIssue) {
      case 'INVALID_FORMAT':
        message = `Schema '${schemaName}' version '${version}' must follow semantic versioning (x.y.z)`;
        suggestions = [
          {
            type: 'fix',
            message: 'Use semantic versioning format',
            action: 'Change version to format like 1.0.0',
          },
          {
            type: 'documentation',
            message: 'Learn about semantic versioning',
            url: 'https://semver.org',
          },
        ];
        break;
      case 'VERSION_CONFLICT':
        message = `Schema '${schemaName}' version '${version}' conflicts with existing version`;
        suggestions = [
          {
            type: 'fix',
            message: 'Use a different version number',
            action: 'Increment version appropriately',
          },
        ];
        break;
      case 'UNSUPPORTED_VERSION':
        message = `Schema '${schemaName}' version '${version}' is not supported`;
        suggestions = [
          {
            type: 'fix',
            message: 'Use a supported version',
            action: 'Check supported version range',
          },
        ];
        break;
    }

    super(versionIssue, message, ValidationSeverity.error, { ...context, schemaName, schemaVersion: version }, suggestions, { schemaName, version, versionIssue });
  }
}

export class SchemaCircularReferenceError extends BaseValidationError {
  constructor(schemaName: string, circularPath: string[], context?: ValidationErrorContext) {
    const message = `Circular reference detected in schema '${schemaName}': ${circularPath.join(' -> ')}`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: 'Break the circular reference by using references instead of nested objects',
        action: 'Use reference fields instead of direct nesting',
      },
      {
        type: 'alternative',
        message: 'Restructure schema to avoid circular dependencies',
      },
      {
        type: 'documentation',
        message: 'Learn about handling circular references',
        url: '/docs/circular-references',
      },
    ];

    super('CIRCULAR_REFERENCE', message, ValidationSeverity.error, { ...context, schemaName }, suggestions, { schemaName, circularPath });
  }
}

export class SchemaFieldNamingError extends BaseValidationError {
  constructor(schemaName: string, namingIssue: 'DUPLICATE_FIELDS' | 'INVALID_FIELD_NAMES', affectedFields: string[], context?: ValidationErrorContext) {
    let message: string;
    let suggestions: ValidationErrorSuggestion[] = [];

    switch (namingIssue) {
      case 'DUPLICATE_FIELDS':
        message = `Schema '${schemaName}' has duplicate field names: ${affectedFields.join(', ')}`;
        suggestions = [
          {
            type: 'fix',
            message: 'Remove duplicate field definitions',
            action: 'Ensure each field name is unique',
          },
        ];
        break;
      case 'INVALID_FIELD_NAMES':
        message = `Schema '${schemaName}' has invalid field names: ${affectedFields.join(', ')}`;
        suggestions = [
          {
            type: 'fix',
            message: 'Use valid field names (alphanumeric, underscore, starting with letter)',
            action: 'Rename fields to follow naming conventions',
          },
          {
            type: 'documentation',
            message: 'Check field naming guidelines',
            url: '/docs/field-naming',
          },
        ];
        break;
    }

    super(namingIssue, message, ValidationSeverity.error, { ...context, schemaName }, suggestions, { schemaName, namingIssue, affectedFields });
  }
}

export class SchemaBusinessRuleError extends BaseValidationError {
  constructor(schemaName: string, ruleViolation: string, description: string, context?: ValidationErrorContext) {
    const message = `Schema '${schemaName}' violates business rule: ${description}`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: 'Review and update schema to comply with business rules',
        action: 'Check business rule documentation',
      },
      {
        type: 'documentation',
        message: 'See business rules documentation',
        url: '/docs/business-rules',
      },
    ];

    super('BUSINESS_RULE_VIOLATION', message, ValidationSeverity.error, { ...context, schemaName }, suggestions, { schemaName, ruleViolation, description });
  }
}

export class SchemaCrossFieldValidationError extends BaseValidationError {
  constructor(
    schemaName: string,
    conflictType: 'FIELD_VISIBILITY_CONFLICT' | 'MISSING_DEPENDENT_FIELD' | 'INCOMPATIBLE_FIELDS',
    fields: string[],
    description: string,
    context?: ValidationErrorContext,
  ) {
    const message = `Schema '${schemaName}' has cross-field validation error: ${description}`;

    const suggestions: ValidationErrorSuggestion[] = [
      {
        type: 'fix',
        message: 'Resolve field conflicts',
        action: `Review fields: ${fields.join(', ')}`,
      },
    ];

    switch (conflictType) {
      case 'FIELD_VISIBILITY_CONFLICT':
        suggestions.push({
          type: 'fix',
          message: 'Choose either expose or exclude, not both',
          action: 'Set only one visibility option per field',
        });
        break;
      case 'MISSING_DEPENDENT_FIELD':
        suggestions.push({
          type: 'fix',
          message: 'Add missing dependent field or remove dependency',
          action: 'Ensure all referenced fields exist',
        });
        break;
      case 'INCOMPATIBLE_FIELDS':
        suggestions.push({
          type: 'fix',
          message: 'Review field compatibility requirements',
          action: 'Update field configurations to be compatible',
        });
        break;
    }

    super(conflictType, message, ValidationSeverity.error, { ...context, schemaName }, suggestions, { schemaName, conflictType, fields, description });
  }
}
