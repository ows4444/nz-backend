import type { ValidationResult } from '../../core/interfaces/validation';

export class SchemaValidationResultEntity {
  constructor(
    public readonly schemaId: string,
    public readonly validationResult: ValidationResult,
    public readonly validatedAt: Date,
    public readonly validatorType: string,
    public readonly schemaVersion?: string,
    public readonly userId?: string,
  ) {}

  get isValid(): boolean {
    return this.validationResult.isValid;
  }

  get hasWarnings(): boolean {
    return (this.validationResult.warnings?.length ?? 0) > 0;
  }

  get errorCount(): number {
    return this.validationResult.errors?.length ?? 0;
  }

  get warningCount(): number {
    return this.validationResult.warnings?.length ?? 0;
  }

  toJSON() {
    return {
      schemaId: this.schemaId,
      isValid: this.isValid,
      errors: this.validationResult.errors,
      warnings: this.validationResult.warnings,
      errorCount: this.errorCount,
      warningCount: this.warningCount,
      validatedAt: this.validatedAt,
      validatorType: this.validatorType,
      schemaVersion: this.schemaVersion,
      userId: this.userId,
    };
  }
}
