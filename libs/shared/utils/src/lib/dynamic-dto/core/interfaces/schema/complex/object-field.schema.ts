import type { DeepReadonly } from '../../../../core/types/common.types';
import type { FieldSchema } from '..';
import type { BaseFieldSchema, SerializableCondition } from '../base/base-field.schema';
import type { FieldType } from '../../../../core/types/field.types';
import type { ValidationSeverity } from '../../../../core/enums/validation.enums';

export interface ObjectFieldSchema extends BaseFieldSchema {
  readonly type: typeof FieldType.object;
  readonly properties: DeepReadonly<Record<string, FieldSchema>>;

  // Size constraints
  readonly minProperties?: number;
  readonly maxProperties?: number;

  // Required fields
  readonly required?: readonly string[];
  readonly conditionallyRequired?: readonly ConditionalRequirement[];

  // Additional properties
  readonly additionalProperties?: boolean | FieldSchema;
  readonly patternProperties?: DeepReadonly<Record<string, FieldSchema>>;

  // Dependencies
  readonly dependencies?: DeepReadonly<Record<string, FieldSchema>>;

  // Polymorphism
  readonly discriminator?: DiscriminatorConfig;
  readonly inheritance?: InheritanceConfig;

  // Validation
  readonly crossPropertyValidation?: readonly CrossPropertyValidationRule[];
}

export interface ConditionalRequirement {
  readonly field: string;
  readonly condition: SerializableCondition;
  readonly requiredFields: string[];
}

export interface DiscriminatorConfig {
  readonly propertyName: string;
  readonly mapping: DeepReadonly<Record<string, string>>;
  readonly implicit?: boolean;
}

export interface InheritanceConfig {
  readonly base?: string;
  readonly abstract?: boolean;
  readonly polymorphic?: boolean;
  readonly discriminatorValue?: string;
}

export interface CrossPropertyValidationRule {
  readonly name: string;
  readonly properties: string[];
  readonly condition: string; // Expression
  readonly message?: string;
  readonly severity?: ValidationSeverity;
}
