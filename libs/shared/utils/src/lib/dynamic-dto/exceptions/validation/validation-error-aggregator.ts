import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { SerializedValidationError, ValidationErrorContext } from './base-validation.error';
import { BaseValidationError } from './base-validation.error';
import type { ValidationIssue, ValidationResult } from '../../core/interfaces/validation';

export interface ValidationErrorSummary {
  readonly totalErrors: number;
  readonly criticalErrors: number;
  readonly warnings: number;
  readonly infos: number;
  readonly fieldErrors: Record<string, BaseValidationError[]>;
  readonly schemaErrors: BaseValidationError[];
  readonly hasBlockingErrors: boolean;
  readonly errorsByCode: Record<string, BaseValidationError[]>;
}

export class ValidationErrorAggregator {
  private readonly errors: BaseValidationError[] = [];
  private readonly context?: ValidationErrorContext;

  constructor(context?: ValidationErrorContext) {
    this.context = context;
  }

  /**
   * Add a single validation error
   */
  addError(error: BaseValidationError): this {
    this.errors.push(error);
    return this;
  }

  /**
   * Add multiple validation errors
   */
  addErrors(errors: BaseValidationError[]): this {
    this.errors.push(...errors);
    return this;
  }

  /**
   * Convert ValidationResult to errors and add them
   */
  addFromValidationResult(result: ValidationResult): this {
    if (result.issues) {
      const errors = BaseValidationError.fromValidationIssues(result.issues, this.context);
      this.addErrors(errors);
    }
    return this;
  }

  /**
   * Convert ValidationIssues to errors and add them
   */
  addFromValidationIssues(issues: ValidationIssue[]): this {
    const errors = BaseValidationError.fromValidationIssues(issues, this.context);
    this.addErrors(errors);
    return this;
  }

  /**
   * Check if aggregator has any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Check if aggregator has critical errors
   */
  hasCriticalErrors(): boolean {
    return this.errors.some((error) => error.isCritical());
  }

  /**
   * Get all errors
   */
  getErrors(): readonly BaseValidationError[] {
    return [...this.errors];
  }

  /**
   * Get errors by severity
   */
  getErrorsBySeverity(severity: ValidationSeverity): BaseValidationError[] {
    return this.errors.filter((error) => error.severity === severity);
  }

  /**
   * Get errors by field path
   */
  getErrorsByField(fieldPath: string): BaseValidationError[] {
    return this.errors.filter((error) => error.context?.fieldPath === fieldPath);
  }

  /**
   * Get errors by error code
   */
  getErrorsByCode(code: string): BaseValidationError[] {
    return this.errors.filter((error) => error.code === code);
  }

  /**
   * Get detailed error summary
   */
  getSummary(): ValidationErrorSummary {
    const fieldErrors: Record<string, BaseValidationError[]> = {};
    const schemaErrors: BaseValidationError[] = [];
    const errorsByCode: Record<string, BaseValidationError[]> = {};

    // Group errors by field and code
    for (const error of this.errors) {
      // Group by field
      if (error.context?.fieldPath) {
        if (!fieldErrors[error.context.fieldPath]) {
          fieldErrors[error.context.fieldPath] = [];
        }
        fieldErrors[error.context.fieldPath].push(error);
      } else {
        schemaErrors.push(error);
      }

      // Group by code
      if (!errorsByCode[error.code]) {
        errorsByCode[error.code] = [];
      }
      errorsByCode[error.code].push(error);
    }

    return {
      totalErrors: this.errors.length,
      criticalErrors: this.getErrorsBySeverity(ValidationSeverity.error).length,
      warnings: this.getErrorsBySeverity(ValidationSeverity.warning).length,
      infos: this.getErrorsBySeverity(ValidationSeverity.info).length,
      fieldErrors,
      schemaErrors,
      hasBlockingErrors: this.hasCriticalErrors(),
      errorsByCode,
    };
  }

  /**
   * Serialize all errors for API response
   */
  serializeErrors(): SerializedValidationError[] {
    return this.errors.map((error) => error.serialize());
  }

  /**
   * Get user-friendly error messages
   */
  getUserMessages(): string[] {
    return this.errors.map((error) => error.getUserMessage());
  }

  /**
   * Get comprehensive error report
   */
  getErrorReport(): string {
    const summary = this.getSummary();
    let report = `Validation Summary:\n`;
    report += `- Total Errors: ${summary.totalErrors}\n`;
    report += `- Critical: ${summary.criticalErrors}\n`;
    report += `- Warnings: ${summary.warnings}\n`;
    report += `- Info: ${summary.infos}\n`;
    report += `- Blocking: ${summary.hasBlockingErrors ? 'Yes' : 'No'}\n\n`;

    if (summary.criticalErrors > 0) {
      report += `Critical Errors:\n`;
      this.getErrorsBySeverity(ValidationSeverity.error).forEach((error, index) => {
        report += `${index + 1}. ${error.getErrorWithSuggestions()}\n\n`;
      });
    }

    if (summary.warnings > 0) {
      report += `Warnings:\n`;
      this.getErrorsBySeverity(ValidationSeverity.warning).forEach((error, index) => {
        report += `${index + 1}. ${error.getErrorWithSuggestions()}\n\n`;
      });
    }

    return report;
  }

  /**
   * Clear all errors
   */
  clear(): this {
    this.errors.length = 0;
    return this;
  }

  /**
   * Filter errors by predicate
   */
  filter(predicate: (error: BaseValidationError) => boolean): BaseValidationError[] {
    return this.errors.filter(predicate);
  }

  /**
   * Group errors by a key function
   */
  groupBy<K extends string | number>(keyFn: (error: BaseValidationError) => K): Record<K, BaseValidationError[]> {
    return this.errors.reduce(
      (groups: Record<K, BaseValidationError[]>, error) => {
        const key = keyFn(error);
        if (!groups[key]) {
          groups[key] = [];
        }
        groups[key].push(error);
        return groups;
      },
      {} as Record<K, BaseValidationError[]>,
    );
  }

  /**
   * Create a new aggregator with only critical errors
   */
  getCriticalErrorsAggregator(): ValidationErrorAggregator {
    const aggregator = new ValidationErrorAggregator(this.context);
    aggregator.addErrors(this.getErrorsBySeverity(ValidationSeverity.error));
    return aggregator;
  }

  /**
   * Check if specific error code exists
   */
  hasErrorCode(code: string): boolean {
    return this.errors.some((error) => error.code === code);
  }

  /**
   * Get unique error codes
   */
  getErrorCodes(): string[] {
    return [...new Set(this.errors.map((error) => error.code))];
  }

  /**
   * Convert to ValidationResult format
   */
  toValidationResult(): ValidationResult {
    const issues: ValidationIssue[] = this.errors.map((error) => ({
      message: error.message,
      code: error.code,
      severity: error.severity,
      fieldPath: error.context?.fieldPath,
      metadata: error.metadata,
    }));

    return {
      isValid: !this.hasCriticalErrors(),
      issues,
      errors: this.getErrorsBySeverity(ValidationSeverity.error).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath,
        metadata: e.metadata,
      })),
      warnings: this.getErrorsBySeverity(ValidationSeverity.warning).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath,
        metadata: e.metadata,
      })),
      infos: this.getErrorsBySeverity(ValidationSeverity.info).map((e) => ({
        message: e.message,
        code: e.code,
        severity: e.severity,
        fieldPath: e.context?.fieldPath,
        metadata: e.metadata,
      })),
    };
  }
}
