import { ValidationSeverity } from '../../core/enums/validation.enums';
import type { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import type { DeepReadonly } from '../../core/types/common.types';

export abstract class BaseValidationError extends Error {
  public readonly timestamp: Date;
  public readonly severity: ValidationSeverity;
  public readonly context?: ValidationErrorContext;
  public readonly suggestions: ValidationErrorSuggestion[];
  public readonly metadata: DeepReadonly<Record<string, unknown>>;

  constructor(
    public readonly code: string,
    message: string,
    severity: ValidationSeverity = ValidationSeverity.error,
    context?: ValidationErrorContext,
    suggestions: ValidationErrorSuggestion[] = [],
    metadata: Record<string, unknown> = {},
  ) {
    super(message);

    this.name = this.constructor.name;
    this.timestamp = new Date();
    this.severity = severity;
    this.context = context;
    this.suggestions = suggestions;
    this.metadata = Object.freeze(metadata);

    // Maintain proper prototype chain
    Object.setPrototypeOf(this, new.target.prototype);

    // Capture stack trace for debugging
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert ValidationIssue to ValidationError
   */
  static fromValidationIssue(issue: ValidationIssue, context?: ValidationErrorContext): BaseValidationError {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    return new ValidationFieldError(
      issue.code,
      issue.message,
      issue.severity,
      {
        ...context,
        fieldPath: issue.fieldPath,
      },
      [],
      issue.metadata || {},
    );
  }

  /**
   * Create multiple errors from ValidationIssues
   */
  static fromValidationIssues(issues: ValidationIssue[], context?: ValidationErrorContext): BaseValidationError[] {
    return issues.map((issue) => this.fromValidationIssue(issue, context));
  }

  /**
   * Serialize error for logging or API responses
   */
  serialize(): SerializedValidationError {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      severity: this.severity,
      context: this.context,
      suggestions: this.suggestions,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };
  }

  /**
   * Create user-friendly error message
   */
  getUserMessage(): string {
    const contextInfo = this.context?.fieldPath ? ` in field '${this.context.fieldPath}'` : '';
    return `${this.message}${contextInfo}`;
  }

  /**
   * Get error with suggestions for resolution
   */
  getErrorWithSuggestions(): string {
    let message = this.getUserMessage();

    if (this.suggestions.length > 0) {
      message += '\n\nSuggestions:';
      this.suggestions.forEach((suggestion, index) => {
        message += `\n${index + 1}. ${suggestion.message}`;
        if (suggestion.action) {
          message += ` (${suggestion.action})`;
        }
      });
    }

    return message;
  }

  /**
   * Check if error is critical (ERROR severity)
   */
  isCritical(): boolean {
    return this.severity === ValidationSeverity.error;
  }

  /**
   * Check if error is a warning
   */
  isWarning(): boolean {
    return this.severity === ValidationSeverity.warning;
  }

  /**
   * Check if error is informational
   */
  isInfo(): boolean {
    return this.severity === ValidationSeverity.info;
  }

  /**
   * Add suggestion to the error
   */
  addSuggestion(suggestion: ValidationErrorSuggestion): this {
    this.suggestions.push(suggestion);
    return this;
  }

  /**
   * Create a copy with additional context
   */
  withContext(additionalContext: Partial<ValidationErrorContext>): BaseValidationError {
    const newContext = { ...this.context, ...additionalContext };
    return new (this.constructor as any)(this.code, this.message, this.severity, newContext, this.suggestions, this.metadata);
  }
}

// Concrete implementation for field validation errors
export class ValidationFieldError extends BaseValidationError {
  constructor(
    code: string,
    message: string,
    severity: ValidationSeverity = ValidationSeverity.error,
    context?: ValidationErrorContext,
    suggestions: ValidationErrorSuggestion[] = [],
    metadata: Record<string, unknown> = {},
  ) {
    super(code, message, severity, context, suggestions, metadata);
  }
}

export interface ValidationErrorContext {
  readonly fieldPath?: string;
  readonly schemaName?: string;
  readonly schemaVersion?: string;
  readonly operation?: 'create' | 'read' | 'update' | 'delete';
  readonly userRoles?: readonly string[];
  readonly timestamp?: Date;
  readonly requestId?: string;
}

export interface ValidationErrorSuggestion {
  readonly type: 'fix' | 'alternative' | 'documentation';
  readonly message: string;
  readonly action?: string;
  readonly url?: string;
}

export interface SerializedValidationError {
  readonly name: string;
  readonly code: string;
  readonly message: string;
  readonly severity: ValidationSeverity;
  readonly context?: ValidationErrorContext;
  readonly suggestions?: readonly ValidationErrorSuggestion[];
  readonly metadata?: DeepReadonly<Record<string, unknown>>;
  readonly timestamp: string;
  readonly stack?: string;
}
