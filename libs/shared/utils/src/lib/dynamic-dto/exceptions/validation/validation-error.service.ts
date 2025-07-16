import { Injectable, Logger } from '@nestjs/common';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { ValidationIssue, ValidationResult } from '../../core/interfaces/validation';
import { BaseValidationError, ValidationErrorContext } from './base-validation.error';
import { ValidationErrorAggregator } from './validation-error-aggregator';
import {
  FieldConstraintValidationError,
  FieldDeprecationValidationError,
  FieldPermissionValidationError,
  FieldRequiredValidationError,
  FieldSecurityValidationError,
  FieldTypeValidationError,
} from './field-validation.error';
import {
  SchemaBusinessRuleError,
  SchemaCircularReferenceError,
  SchemaCrossFieldValidationError,
  SchemaFieldNamingError,
  SchemaStructureValidationError,
  SchemaVersionValidationError,
} from './schema-validation.error';

export interface ValidationErrorMetrics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<ValidationSeverity, number>;
  averageErrorsPerField: number;
  mostCommonErrors: { code: string; count: number }[];
  errorTrends: { timestamp: Date; errorCount: number }[];
}

@Injectable()
export class ValidationErrorService {
  private readonly logger = new Logger(ValidationErrorService.name);
  private readonly errorMetrics: ValidationErrorMetrics = {
    totalErrors: 0,
    errorsByType: {},
    errorsBySeverity: {
      [ValidationSeverity.error]: 0,
      [ValidationSeverity.warning]: 0,
      [ValidationSeverity.info]: 0,
      [ValidationSeverity.debug]: 0,
    },
    averageErrorsPerField: 0,
    mostCommonErrors: [],
    errorTrends: [],
  };

  /**
   * Create optimized field validation errors
   */
  createFieldError(
    errorType: 'TYPE_MISMATCH' | 'REQUIRED' | 'CONSTRAINT' | 'PERMISSION' | 'DEPRECATED' | 'SECURITY',
    fieldName: string,
    details: any,
    context?: ValidationErrorContext,
  ): BaseValidationError {
    switch (errorType) {
      case 'TYPE_MISMATCH':
        return new FieldTypeValidationError(fieldName, details.expectedType, details.actualType, context);
      case 'REQUIRED':
        return new FieldRequiredValidationError(fieldName, context);
      case 'CONSTRAINT':
        return new FieldConstraintValidationError(fieldName, details.constraintType, details.constraintValue, details.actualValue, context);
      case 'PERMISSION':
        return new FieldPermissionValidationError(fieldName, details.requiredPermissions, details.userRoles, details.operation, context);
      case 'DEPRECATED':
        return new FieldDeprecationValidationError(fieldName, details, context);
      case 'SECURITY':
        return new FieldSecurityValidationError(fieldName, details.securityIssue, context);
      default:
        throw new Error(`Unknown field error type: ${String(errorType)}`);
    }
  }

  /**
   * Create optimized schema validation errors
   */
  createSchemaError(
    errorType: 'STRUCTURE' | 'VERSION' | 'CIRCULAR_REFERENCE' | 'FIELD_NAMING' | 'BUSINESS_RULE' | 'CROSS_FIELD',
    schemaName: string,
    details: any,
    context?: ValidationErrorContext,
  ): BaseValidationError {
    switch (errorType) {
      case 'STRUCTURE':
        return new SchemaStructureValidationError(schemaName, details.structureIssue, context);
      case 'VERSION':
        return new SchemaVersionValidationError(schemaName, details.version, details.versionIssue, context);
      case 'CIRCULAR_REFERENCE':
        return new SchemaCircularReferenceError(schemaName, details.circularPath, context);
      case 'FIELD_NAMING':
        return new SchemaFieldNamingError(schemaName, details.namingIssue, details.affectedFields, context);
      case 'BUSINESS_RULE':
        return new SchemaBusinessRuleError(schemaName, details.ruleViolation, details.description, context);
      case 'CROSS_FIELD':
        return new SchemaCrossFieldValidationError(schemaName, details.conflictType, details.fields, details.description, context);
      default:
        throw new Error(`Unknown schema error type: ${String(errorType)}`);
    }
  }

  /**
   * Create aggregator from ValidationResult
   */
  createAggregatorFromResult(result: ValidationResult, context?: ValidationErrorContext): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(context);
    aggregator.addFromValidationResult(result);
    this.updateMetrics(aggregator);
    return aggregator;
  }

  /**
   * Create aggregator from ValidationIssues
   */
  createAggregatorFromIssues(issues: ValidationIssue[], context?: ValidationErrorContext): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(context);
    aggregator.addFromValidationIssues(issues);
    this.updateMetrics(aggregator);
    return aggregator;
  }

  /**
   * Optimize error collection for performance
   */
  optimizeErrors(errors: BaseValidationError[]): BaseValidationError[] {
    // Remove duplicate errors
    const uniqueErrors = this.deduplicateErrors(errors);

    // Prioritize critical errors
    const prioritized = this.prioritizeErrors(uniqueErrors);

    // Limit total errors for performance
    const limited = this.limitErrors(prioritized);

    this.logger.debug(`Optimized ${errors.length} errors to ${limited.length} unique, prioritized errors`);

    return limited;
  }

  /**
   * Remove duplicate errors based on code and field path
   */
  private deduplicateErrors(errors: BaseValidationError[]): BaseValidationError[] {
    const seen = new Set<string>();
    return errors.filter((error) => {
      const key = `${error.code}:${error.context?.fieldPath || 'schema'}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  /**
   * Sort errors by severity and importance
   */
  private prioritizeErrors(errors: BaseValidationError[]): BaseValidationError[] {
    return errors.sort((a, b) => {
      // First by severity (ERROR > WARNING > INFO)
      const severityOrder = {
        [ValidationSeverity.error]: 3,
        [ValidationSeverity.warning]: 2,
        [ValidationSeverity.info]: 1,
      };

      const severityDiff = severityOrder[b.severity] - severityOrder[a.severity];
      if (severityDiff !== 0) return severityDiff;

      // Then by error code priority
      const criticalCodes = ['FIELD_REQUIRED', 'FIELD_TYPE_MISMATCH', 'FIELD_PERMISSION_DENIED'];
      const aIsCritical = criticalCodes.includes(a.code);
      const bIsCritical = criticalCodes.includes(b.code);

      if (aIsCritical && !bIsCritical) return -1;
      if (!aIsCritical && bIsCritical) return 1;

      // Finally by alphabetical order for consistency
      return a.code.localeCompare(b.code);
    });
  }

  /**
   * Limit errors to prevent performance issues
   */
  private limitErrors(errors: BaseValidationError[], maxErrors = 50): BaseValidationError[] {
    if (errors.length <= maxErrors) {
      return errors;
    }

    // Keep all critical errors and limit others
    const criticalErrors = errors.filter((error) => error.isCritical());
    const nonCriticalErrors = errors.filter((error) => !error.isCritical());

    const remainingSlots = maxErrors - criticalErrors.length;
    const limitedNonCritical = nonCriticalErrors.slice(0, Math.max(0, remainingSlots));

    this.logger.warn(`Limited errors from ${errors.length} to ${maxErrors} (${criticalErrors.length} critical, ${limitedNonCritical.length} non-critical)`);

    return [...criticalErrors, ...limitedNonCritical];
  }

  /**
   * Update error metrics for monitoring
   */
  private updateMetrics(aggregator: ValidationErrorAggregator): void {
    const errors = aggregator.getErrors();

    // Update totals
    this.errorMetrics.totalErrors += errors.length;

    // Update by type
    for (const error of errors) {
      this.errorMetrics.errorsByType[error.constructor.name] = (this.errorMetrics.errorsByType[error.constructor.name] || 0) + 1;
    }

    // Update by severity
    for (const error of errors) {
      this.errorMetrics.errorsBySeverity[error.severity]++;
    }

    // Update trends (simplified)
    this.errorMetrics.errorTrends.push({
      timestamp: new Date(),
      errorCount: errors.length,
    });

    // Keep only last 100 trend points
    if (this.errorMetrics.errorTrends.length > 100) {
      this.errorMetrics.errorTrends = this.errorMetrics.errorTrends.slice(-100);
    }
  }

  /**
   * Get error metrics for monitoring
   */
  getMetrics(): ValidationErrorMetrics {
    // Calculate most common errors
    const errorCounts = Object.entries(this.errorMetrics.errorsByType)
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      ...this.errorMetrics,
      mostCommonErrors: errorCounts,
    };
  }

  /**
   * Reset metrics (useful for testing)
   */
  resetMetrics(): void {
    this.errorMetrics.totalErrors = 0;
    this.errorMetrics.errorsByType = {};
    this.errorMetrics.errorsBySeverity = {
      [ValidationSeverity.error]: 0,
      [ValidationSeverity.warning]: 0,
      [ValidationSeverity.info]: 0,
      [ValidationSeverity.debug]: 0,
    };
    this.errorMetrics.averageErrorsPerField = 0;
    this.errorMetrics.mostCommonErrors = [];
    this.errorMetrics.errorTrends = [];
  }

  /**
   * Create context-aware error aggregator
   */
  createContextAggregator(
    schemaName?: string,
    schemaVersion?: string,
    userRoles?: readonly string[],
    operation?: 'create' | 'read' | 'update' | 'delete',
    requestId?: string,
  ): ValidationErrorAggregator {
    const context: ValidationErrorContext = {
      schemaName,
      schemaVersion,
      userRoles,
      operation,
      requestId,
      timestamp: new Date(),
    };

    return new ValidationErrorAggregator(context);
  }

  /**
   * Log error summary for debugging
   */
  logErrorSummary(aggregator: ValidationErrorAggregator): void {
    const summary = aggregator.getSummary();

    if (summary.hasBlockingErrors) {
      this.logger.error(`Validation failed: ${summary.criticalErrors} critical errors, ${summary.warnings} warnings`);
    } else if (summary.warnings > 0) {
      this.logger.warn(`Validation passed with warnings: ${summary.warnings} warnings`);
    } else {
      this.logger.debug('Validation passed successfully');
    }

    // Log top error codes for debugging
    const topErrors = Object.entries(summary.errorsByCode)
      .sort(([, a], [, b]) => b.length - a.length)
      .slice(0, 5)
      .map(([code, errors]) => `${code}(${errors.length})`)
      .join(', ');

    if (topErrors) {
      this.logger.debug(`Top error codes: ${topErrors}`);
    }
  }
}
