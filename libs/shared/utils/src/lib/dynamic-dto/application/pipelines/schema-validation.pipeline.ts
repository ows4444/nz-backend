import { Injectable } from '@nestjs/common';
import { ValidationContext, ValidationResult } from '../../core/interfaces/validation';
import { SchemaOrchestratorService } from '../services/schema-orchestrator.service';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { ValidationIssue } from '../../core/interfaces/validation/validation-issue.interface';
import { FieldSchema } from '../../core/interfaces/schema';

export interface SchemaValidationPipelineOptions {
  userId?: string;
  userRoles?: string[];
  includeIntegrityCheck?: boolean;
  schemaVersion?: string;
}

@Injectable()
export class SchemaValidationPipeline {
  constructor(private readonly schemaOrchestrator: SchemaOrchestratorService) {}

  execute(schema: DynamicSchemaEntity, options: SchemaValidationPipelineOptions = {}): ValidationResult {
    const { userRoles, schemaVersion } = options;

    const schemaProperties: Record<string, FieldSchema> = schema instanceof DynamicSchemaEntity ? schema.properties : schema;

    // Enhanced validation with context
    const context: Partial<ValidationContext> = {
      userRoles,
      schemaVersion,
    };

    const result = this.schemaOrchestrator.validateSchema(schemaProperties, context);

    // Add additional business logic validation if needed
    if (result.isValid && schema instanceof DynamicSchemaEntity) {
      const businessValidationResult = this.validateBusinessRules(schema);
      if (!businessValidationResult.isValid) {
        result.isValid = false;
        if (businessValidationResult.errors) result.errors?.push(...businessValidationResult.errors);
        if (businessValidationResult.issues) result.issues?.push(...businessValidationResult.issues);
        if (businessValidationResult.infos) result.infos?.push(...businessValidationResult.infos);
        if (businessValidationResult.warnings) result.warnings?.push(...businessValidationResult.warnings);
      }
    }

    return result;
  }

  private validateBusinessRules(schema: DynamicSchemaEntity): ValidationResult {
    const errors: ValidationIssue[] = [];
    const warnings: ValidationIssue[] = [];

    // Example business rule: Required fields must have a type
    for (const requiredField of schema.getRequiredFields()) {
      if (!schema.hasField(requiredField)) {
        errors.push({
          message: `Required field "${requiredField}" is missing in schema "${schema.name}".`,
          severity: 'error',
          code: 'MISSING_REQUIRED_FIELD',
          fieldPath: schema.name,
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      infos: [],
      issues: [],
      warnings,
    };
  }
}
