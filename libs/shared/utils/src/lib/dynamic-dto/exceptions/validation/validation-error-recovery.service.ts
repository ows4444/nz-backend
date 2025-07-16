import { Injectable, Logger } from '@nestjs/common';
import { ValidationSeverity } from '../../core/enums/validation.enums';
import { FieldTypeValue } from '../../core/types/field.types';
import { BaseValidationError } from './base-validation.error';
import { ValidationErrorAggregator } from './validation-error-aggregator';

export interface RecoveryPlan {
  readonly canAutoRecover: boolean;
  readonly recoverySteps: RecoveryStep[];
  readonly manualSteps: ManualStep[];
  readonly estimatedRecoveryTime: number; // in minutes
  readonly riskLevel: 'low' | 'medium' | 'high';
}

export interface RecoveryStep {
  readonly id: string;
  readonly action: 'fix_type' | 'add_field' | 'remove_field' | 'update_constraint' | 'fix_permission';
  readonly description: string;
  readonly targetField?: string;
  readonly parameters: Record<string, unknown>;
  readonly autoExecutable: boolean;
}

export interface ManualStep {
  readonly id: string;
  readonly description: string;
  readonly priority: 'high' | 'medium' | 'low';
  readonly documentation?: string;
  readonly examples?: string[];
}

@Injectable()
export class ValidationErrorRecoveryService {
  private readonly logger = new Logger(ValidationErrorRecoveryService.name);

  /**
   * Generate recovery plan for validation errors
   */
  generateRecoveryPlan(aggregator: ValidationErrorAggregator): RecoveryPlan {
    const errors = aggregator.getErrors();
    const summary = aggregator.getSummary();

    const recoverySteps: RecoveryStep[] = [];
    const manualSteps: ManualStep[] = [];

    // Process each error type
    for (const error of errors) {
      const steps = this.generateErrorRecoverySteps(error);
      recoverySteps.push(...steps.autoSteps);
      manualSteps.push(...steps.manualSteps);
    }

    // Calculate recovery metrics
    const canAutoRecover = recoverySteps.length > 0 && recoverySteps.length >= Math.floor(summary.criticalErrors * 0.7);

    const estimatedTime = this.calculateRecoveryTime(recoverySteps, manualSteps);
    const riskLevel = this.assessRiskLevel(summary, recoverySteps);

    return {
      canAutoRecover,
      recoverySteps: this.deduplicateSteps(recoverySteps),
      manualSteps: this.prioritizeManualSteps(manualSteps),
      estimatedRecoveryTime: estimatedTime,
      riskLevel,
    };
  }

  /**
   * Generate recovery steps for specific error
   */
  private generateErrorRecoverySteps(error: BaseValidationError): {
    autoSteps: RecoveryStep[];
    manualSteps: ManualStep[];
  } {
    const autoSteps: RecoveryStep[] = [];
    const manualSteps: ManualStep[] = [];

    switch (error.code) {
      case 'FIELD_TYPE_MISMATCH':
        autoSteps.push({
          id: `fix_type_${error.context?.fieldPath}`,
          action: 'fix_type',
          description: `Auto-convert field '${error.context?.fieldPath}' to expected type`,
          targetField: error.context?.fieldPath,
          parameters: {
            expectedType: error.metadata.expectedType,
            currentType: error.metadata.actualType,
          },
          autoExecutable: this.isTypeConversionSafe(error.metadata.actualType as string, error.metadata.expectedType as FieldTypeValue),
        });
        break;

      case 'FIELD_REQUIRED':
        manualSteps.push({
          id: `add_required_${error.context?.fieldPath}`,
          description: `Provide value for required field '${error.context?.fieldPath}'`,
          priority: 'high',
          examples: ['Set a default value', 'Make field optional', 'Provide input value'],
        });
        break;

      case 'FIELD_CONSTRAINT_VIOLATION':
        autoSteps.push({
          id: `fix_constraint_${error.context?.fieldPath}`,
          action: 'update_constraint',
          description: `Auto-adjust constraint for field '${error.context?.fieldPath}'`,
          targetField: error.context?.fieldPath,
          parameters: {
            constraintType: error.metadata.constraintType,
            expectedValue: error.metadata.constraintValue,
            actualValue: error.metadata.actualValue,
          },
          autoExecutable: this.isConstraintAdjustmentSafe(error.metadata.constraintType as string),
        });
        break;

      case 'FIELD_PERMISSION_DENIED':
        manualSteps.push({
          id: `fix_permission_${error.context?.fieldPath}`,
          description: `Request permissions for field '${error.context?.fieldPath}'`,
          priority: 'high',
          documentation: '/docs/permissions',
          examples: ['Contact administrator', 'Request role assignment', 'Use different operation'],
        });
        break;

      case 'FIELD_DEPRECATED':
        autoSteps.push({
          id: `replace_deprecated_${error.context?.fieldPath}`,
          action: 'remove_field',
          description: `Replace deprecated field '${error.context?.fieldPath}'`,
          targetField: error.context?.fieldPath,
          parameters: {
            replacedBy: error.metadata.replacedBy,
            migrationGuide: error.metadata.migrationGuide,
          },
          autoExecutable: !!error.metadata.replacedBy,
        });
        break;

      case 'DUPLICATE_FIELD_NAMES':
        autoSteps.push({
          id: `fix_duplicates_${error.context?.schemaName}`,
          action: 'remove_field',
          description: 'Remove duplicate field definitions',
          parameters: {
            duplicateFields: error.metadata.duplicates,
          },
          autoExecutable: true,
        });
        break;

      case 'CIRCULAR_REFERENCE':
        manualSteps.push({
          id: `fix_circular_${error.context?.schemaName}`,
          description: 'Resolve circular reference in schema',
          priority: 'high',
          documentation: '/docs/circular-references',
          examples: ['Use reference fields instead of nesting', 'Restructure schema hierarchy', 'Break circular dependency'],
        });
        break;

      default:
        // Generic manual step for unknown errors
        manualSteps.push({
          id: `manual_fix_${error.code}`,
          description: `Manually resolve: ${error.message}`,
          priority: error.severity === ValidationSeverity.error ? 'high' : 'medium',
        });
        break;
    }

    return { autoSteps, manualSteps };
  }

  /**
   * Check if type conversion is safe to perform automatically
   */
  private isTypeConversionSafe(currentType: string, expectedType: FieldTypeValue): boolean {
    const safeConversions: Record<string, FieldTypeValue[]> = {
      string: ['string'],
      number: ['number', 'string'],
      boolean: ['boolean', 'string'],
      undefined: ['string', 'number', 'boolean'], // Can set default values
    };

    return safeConversions[currentType]?.includes(expectedType) ?? false;
  }

  /**
   * Check if constraint adjustment is safe
   */
  private isConstraintAdjustmentSafe(constraintType: string): boolean {
    const safeConstraints = ['minLength', 'maxLength', 'min', 'max'];
    return safeConstraints.includes(constraintType);
  }

  /**
   * Remove duplicate recovery steps
   */
  private deduplicateSteps(steps: RecoveryStep[]): RecoveryStep[] {
    const seen = new Set<string>();
    return steps.filter((step) => {
      const key = `${step.action}:${step.targetField || 'global'}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Prioritize manual steps by impact and urgency
   */
  private prioritizeManualSteps(steps: ManualStep[]): ManualStep[] {
    return steps.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Calculate estimated recovery time
   */
  private calculateRecoveryTime(autoSteps: RecoveryStep[], manualSteps: ManualStep[]): number {
    // Auto steps: 1 minute each
    const autoTime = autoSteps.length * 1;

    // Manual steps: varies by priority
    const manualTime = manualSteps.reduce((total, step) => {
      const timeMap = { high: 15, medium: 10, low: 5 };
      return total + timeMap[step.priority];
    }, 0);

    return autoTime + manualTime;
  }

  /**
   * Assess risk level of recovery operations
   */
  private assessRiskLevel(summary: any, recoverySteps: RecoveryStep[]): 'low' | 'medium' | 'high' {
    // High risk if many critical errors or risky operations
    if (summary.criticalErrors > 10 || recoverySteps.some((s) => s.action === 'remove_field')) {
      return 'high';
    }

    // Medium risk if moderate errors or some auto-operations
    if (summary.criticalErrors > 3 || recoverySteps.length > 5) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Execute automated recovery steps
   */
  async executeRecoveryPlan(
    plan: RecoveryPlan,
    schema: any,
    dryRun = true,
  ): Promise<{
    success: boolean;
    executedSteps: string[];
    remainingIssues: string[];
    modifiedSchema?: any;
  }> {
    if (!plan.canAutoRecover) {
      this.logger.warn('Recovery plan cannot be auto-executed');
      return {
        success: false,
        executedSteps: [],
        remainingIssues: plan.manualSteps.map((s) => s.description),
      };
    }

    const executedSteps: string[] = [];
    const remainingIssues: string[] = [];
    let modifiedSchema = dryRun ? { ...schema } : schema;

    for (const step of plan.recoverySteps) {
      if (!step.autoExecutable) {
        remainingIssues.push(step.description);
        continue;
      }

      try {
        if (!dryRun) {
          modifiedSchema = await this.executeRecoveryStep(step, modifiedSchema);
        }
        executedSteps.push(step.description);
        this.logger.debug(`Executed recovery step: ${step.description}`);
      } catch (error) {
        this.logger.error(`Failed to execute recovery step: ${step.description}`, error);
        remainingIssues.push(step.description);
      }
    }

    // Add manual steps to remaining issues
    remainingIssues.push(...plan.manualSteps.map((s) => s.description));

    return {
      success: executedSteps.length > 0,
      executedSteps,
      remainingIssues,
      modifiedSchema: dryRun ? modifiedSchema : undefined,
    };
  }

  /**
   * Execute individual recovery step
   */
  private executeRecoveryStep(step: RecoveryStep, schema: any): Promise<any> {
    switch (step.action) {
      case 'fix_type':
        return this.fixFieldType(schema, step);
      case 'add_field':
        return this.addField(schema, step);
      case 'remove_field':
        return this.removeField(schema, step);
      case 'update_constraint':
        return this.updateConstraint(schema, step);
      default:
        throw new Error(`Unknown recovery action: ${step.action}`);
    }
  }

  private fixFieldType(schema: any, step: RecoveryStep): any {
    // Implementation would depend on your schema structure
    // This is a placeholder for the actual implementation
    this.logger.debug(`Fixing field type for ${step.targetField}`);
    return schema;
  }

  private addField(schema: any, step: RecoveryStep): any {
    this.logger.debug(`Adding field ${step.targetField}`);
    return schema;
  }

  private removeField(schema: any, step: RecoveryStep): any {
    this.logger.debug(`Removing field ${step.targetField}`);
    return schema;
  }

  private updateConstraint(schema: any, step: RecoveryStep): any {
    this.logger.debug(`Updating constraint for ${step.targetField}`);
    return schema;
  }
}
