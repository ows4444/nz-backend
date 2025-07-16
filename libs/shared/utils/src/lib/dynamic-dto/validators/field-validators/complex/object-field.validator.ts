import { Injectable } from '@nestjs/common';
import {
  BaseFieldSchema,
  BaseFieldValidator,
  ConditionalRequirement,
  CrossPropertyValidationRule,
  DiscriminatorConfig,
  FieldSchema,
  InheritanceConfig,
  ObjectFieldSchema,
  ValidationContext,
  ValidationResult,
  ValidationResultBuilder,
} from '../../../core';
import { FieldType } from '../../../core/types/field.types';
import { DeepReadonly } from '../../../core/types/common.types';

@Injectable()
export class ObjectFieldValidator extends BaseFieldValidator<ObjectFieldSchema> {
  readonly supportedType = FieldType.object;
  readonly priority = 100;
  readonly name = 'ObjectFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is ObjectFieldSchema {
    return schema.type === FieldType.object;
  }

  validateStructure(schema: ObjectFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateBasicStructure(schema, builder);
    this.validatePropertiesStructure(schema, builder, context);
    this.validateRequiredFieldsStructure(schema, builder);
    this.validateSizeConstraints(schema, builder);
    this.validateDiscriminatorStructure(schema, builder);
    this.validateInheritanceStructure(schema, builder);

    return builder.build();
  }

  validateConstraints(schema: ObjectFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateRequiredFieldConstraints(schema, builder);
    this.validateConditionalRequirements(schema, builder);
    this.validateDependencyConstraints(schema, builder);
    this.validateDiscriminatorConstraints(schema, builder);
    this.validateCrossPropertyValidation(schema, builder);
    this.validateAdditionalPropertiesConstraints(schema, builder);

    return builder.build();
  }

  protected validateSecurity(schema: ObjectFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateSensitiveDataHandling(schema, builder, context);
    this.validateNestedPermissions(schema, builder, context);
    this.validateInheritanceSecurity(schema, builder);

    return builder.build();
  }

  protected validatePerformance(schema: ObjectFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateNestingDepth(schema, builder, context);
    this.validatePropertyCount(schema, builder);
    this.validateCircularReferences(schema, builder, context);

    return builder.build();
  }

  // Basic structure validation
  private validateBasicStructure(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.properties || typeof schema.properties !== 'object') {
      builder.addError('OBJECT_INVALID_PROPERTIES', 'Object field must have a properties definition', schema.properties);
      return;
    }

    if (Object.keys(schema.properties).length === 0) {
      builder.addWarning('OBJECT_EMPTY_PROPERTIES', 'Object field has no properties defined');
    }
  }

  private validatePropertiesStructure(schema: ObjectFieldSchema, builder: ValidationResultBuilder, context: ValidationContext): void {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      this.validatePropertyName(propName, builder, context);
      this.validatePropertySchema(propName, propSchema, builder, context);
    }
  }

  private validatePropertyName(propName: string, builder: ValidationResultBuilder, _context: ValidationContext): void {
    if (!propName || typeof propName !== 'string') {
      builder.addError('OBJECT_INVALID_PROPERTY_NAME', 'Property name must be a non-empty string', propName);
      return;
    }

    if (!/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(propName)) {
      builder.addWarning('OBJECT_INVALID_PROPERTY_NAME_FORMAT', `Property name '${propName}' should follow valid identifier format`, propName);
    }

    if (propName.startsWith('__')) {
      builder.addWarning('OBJECT_RESERVED_PROPERTY_NAME', `Property name '${propName}' uses reserved prefix '__'`, propName);
    }
  }

  private validatePropertySchema(propName: string, propSchema: DeepReadonly<FieldSchema>, builder: ValidationResultBuilder, context: ValidationContext): void {
    if (!propSchema || typeof propSchema !== 'object') {
      builder.addError('OBJECT_INVALID_PROPERTY_SCHEMA', `Property '${propName}' must have a valid schema definition`, propSchema);
      return;
    }

    if (!propSchema.type) {
      builder.addError('OBJECT_PROPERTY_MISSING_TYPE', `Property '${propName}' is missing required 'type' field`, propSchema);
    }

    // Validate nested objects don't exceed depth limits
    if (propSchema.type === FieldType.object && context.depth >= 10) {
      builder.addWarning('OBJECT_EXCESSIVE_NESTING', `Property '${propName}' creates deep nesting (depth: ${context.depth + 1})`, { depth: context.depth + 1, propName });
    }
  }

  // Required fields validation
  private validateRequiredFieldsStructure(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.required && !Array.isArray(schema.required)) {
      builder.addError('OBJECT_INVALID_REQUIRED_TYPE', 'required field must be an array of strings', schema.required);
      return;
    }

    if (schema.required) {
      this.validateRequiredFieldNames(schema, builder);
    }
  }

  private validateRequiredFieldNames(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    const propertyNames = new Set(Object.keys(schema.properties));
    const duplicates = new Set<string>();
    const seen = new Set<string>();

    for (const fieldName of schema.required!) {
      if (typeof fieldName !== 'string') {
        builder.addError('OBJECT_INVALID_REQUIRED_FIELD_TYPE', 'All required field names must be strings', fieldName);
        continue;
      }

      if (seen.has(fieldName)) {
        duplicates.add(fieldName);
      }
      seen.add(fieldName);

      if (!propertyNames.has(fieldName)) {
        builder.addError('OBJECT_REQUIRED_FIELD_NOT_FOUND', `Required field '${fieldName}' is not defined in properties`, fieldName);
      }
    }

    if (duplicates.size > 0) {
      builder.addWarning('OBJECT_DUPLICATE_REQUIRED_FIELDS', `Duplicate required fields found: ${Array.from(duplicates).join(', ')}`, Array.from(duplicates));
    }
  }

  // Size constraints validation
  private validateSizeConstraints(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.minProperties !== undefined) {
      if (schema.minProperties < 0 || !Number.isInteger(schema.minProperties)) {
        builder.addError('OBJECT_INVALID_MIN_PROPERTIES', 'minProperties must be a non-negative integer', schema.minProperties);
      }
    }

    if (schema.maxProperties !== undefined) {
      if (schema.maxProperties < 0 || !Number.isInteger(schema.maxProperties)) {
        builder.addError('OBJECT_INVALID_MAX_PROPERTIES', 'maxProperties must be a non-negative integer', schema.maxProperties);
      }
    }

    if (schema.minProperties !== undefined && schema.maxProperties !== undefined) {
      if (schema.minProperties > schema.maxProperties) {
        builder.addError('OBJECT_INVALID_PROPERTY_RANGE', `minProperties (${schema.minProperties}) cannot be greater than maxProperties (${schema.maxProperties})`, {
          min: schema.minProperties,
          max: schema.maxProperties,
        });
      }
    }
  }

  // Discriminator validation
  private validateDiscriminatorStructure(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.discriminator) return;

    this.validateDiscriminatorProperty(schema.discriminator, builder, schema);
    this.validateDiscriminatorMapping(schema.discriminator, builder);
  }

  private validateDiscriminatorProperty(discriminator: DiscriminatorConfig, builder: ValidationResultBuilder, schema: ObjectFieldSchema): void {
    if (!discriminator.propertyName || typeof discriminator.propertyName !== 'string') {
      builder.addError('OBJECT_INVALID_DISCRIMINATOR_PROPERTY', 'Discriminator propertyName must be a non-empty string', discriminator.propertyName);
      return;
    }

    if (!schema.properties[discriminator.propertyName]) {
      builder.addError('OBJECT_DISCRIMINATOR_PROPERTY_NOT_FOUND', `Discriminator property '${discriminator.propertyName}' is not defined in object properties`, discriminator.propertyName);
    }
  }

  private validateDiscriminatorMapping(discriminator: DiscriminatorConfig, builder: ValidationResultBuilder): void {
    if (!discriminator.mapping || typeof discriminator.mapping !== 'object') {
      builder.addError('OBJECT_INVALID_DISCRIMINATOR_MAPPING', 'Discriminator mapping must be an object', discriminator.mapping);
      return;
    }

    if (Object.keys(discriminator.mapping).length === 0) {
      builder.addWarning('OBJECT_EMPTY_DISCRIMINATOR_MAPPING', 'Discriminator mapping is empty');
    }
  }

  // Inheritance validation
  private validateInheritanceStructure(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.inheritance) return;

    this.validateInheritanceConfig(schema.inheritance, builder);
    this.validateAbstractInheritance(schema.inheritance, builder, schema);
  }

  private validateInheritanceConfig(inheritance: InheritanceConfig, builder: ValidationResultBuilder): void {
    if (inheritance.base && typeof inheritance.base !== 'string') {
      builder.addError('OBJECT_INVALID_INHERITANCE_BASE', 'Inheritance base must be a string reference', inheritance.base);
    }

    if (inheritance.abstract && inheritance.discriminatorValue) {
      builder.addWarning('OBJECT_ABSTRACT_WITH_DISCRIMINATOR_VALUE', 'Abstract objects should not have discriminator values');
    }
  }

  private validateAbstractInheritance(inheritance: InheritanceConfig, builder: ValidationResultBuilder, schema: ObjectFieldSchema): void {
    if (inheritance.abstract && Object.keys(schema.properties).length === 0) {
      builder.addWarning('OBJECT_EMPTY_ABSTRACT', 'Abstract object has no properties defined');
    }
  }

  // Constraint validation
  private validateRequiredFieldConstraints(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.required?.length) return;

    const propertyCount = Object.keys(schema.properties).length;
    const requiredCount = schema.required.length;

    if (requiredCount > propertyCount) {
      builder.addError('OBJECT_MORE_REQUIRED_THAN_PROPERTIES', `Required fields count (${requiredCount}) exceeds total properties count (${propertyCount})`);
    }

    if (requiredCount === propertyCount) {
      builder.addInfo('OBJECT_ALL_PROPERTIES_REQUIRED', 'All object properties are marked as required');
    }
  }

  private validateConditionalRequirements(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.conditionallyRequired?.length) return;

    for (const [index, conditionalReq] of schema.conditionallyRequired.entries()) {
      this.validateConditionalRequirement(conditionalReq, builder, schema, index);
    }
  }

  private validateConditionalRequirement(conditionalReq: ConditionalRequirement, builder: ValidationResultBuilder, schema: ObjectFieldSchema, index: number): void {
    const reqPath = `conditionallyRequired[${index}]`;

    if (!conditionalReq.field || typeof conditionalReq.field !== 'string') {
      builder.addError('OBJECT_INVALID_CONDITIONAL_FIELD', `${reqPath}.field must be a non-empty string`, conditionalReq.field);
    }

    if (!conditionalReq.requiredFields || !Array.isArray(conditionalReq.requiredFields)) {
      builder.addError('OBJECT_INVALID_CONDITIONAL_REQUIRED_FIELDS', `${reqPath}.requiredFields must be an array`, conditionalReq.requiredFields);
      return;
    }

    const propertyNames = new Set(Object.keys(schema.properties));
    for (const fieldName of conditionalReq.requiredFields) {
      if (!propertyNames.has(fieldName)) {
        builder.addError('OBJECT_CONDITIONAL_REQUIRED_FIELD_NOT_FOUND', `Conditional required field '${fieldName}' is not defined in properties`, fieldName);
      }
    }
  }

  private validateDependencyConstraints(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.dependencies) return;

    for (const [depField, depValue] of Object.entries(schema.dependencies)) {
      this.validateDependency(depField, depValue, builder, schema);
    }
  }

  private validateDependency(depField: string, depValue: DeepReadonly<FieldSchema>, builder: ValidationResultBuilder, schema: ObjectFieldSchema): void {
    if (!schema.properties[depField]) {
      builder.addError('OBJECT_DEPENDENCY_FIELD_NOT_FOUND', `Dependency field '${depField}' is not defined in properties`, depField);
    }

    if (Array.isArray(depValue)) {
      this.validateDependencyArray(depField, depValue, builder, schema);
    } else {
      this.validateDependencySchema(depField, depValue, builder);
    }
  }

  private validateDependencyArray(depField: string, depValue: readonly string[], builder: ValidationResultBuilder, schema: ObjectFieldSchema): void {
    const propertyNames = new Set(Object.keys(schema.properties));

    for (const dependentField of depValue) {
      if (!propertyNames.has(dependentField)) {
        builder.addError('OBJECT_DEPENDENT_FIELD_NOT_FOUND', `Dependent field '${dependentField}' for '${depField}' is not defined in properties`, { depField, dependentField });
      }
    }
  }

  private validateDependencySchema(depField: string, depSchema: DeepReadonly<FieldSchema>, builder: ValidationResultBuilder): void {
    if (!depSchema.type) {
      builder.addError('OBJECT_DEPENDENCY_SCHEMA_MISSING_TYPE', `Dependency schema for '${depField}' is missing type`, depField);
    }
  }

  private validateDiscriminatorConstraints(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.discriminator) return;

    const discriminatorProp = schema.properties[schema.discriminator.propertyName];
    if (discriminatorProp && discriminatorProp.type !== FieldType.string) {
      builder.addWarning('OBJECT_DISCRIMINATOR_TYPE_RECOMMENDATION', `Discriminator property '${schema.discriminator.propertyName}' should be of type 'string'`);
    }
  }

  private validateCrossPropertyValidation(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.crossPropertyValidation?.length) return;

    for (const [index, rule] of schema.crossPropertyValidation.entries()) {
      this.validateCrossPropertyRule(rule, builder, schema, index);
    }
  }

  private validateCrossPropertyRule(rule: CrossPropertyValidationRule, builder: ValidationResultBuilder, schema: ObjectFieldSchema, index: number): void {
    const rulePath = `crossPropertyValidation[${index}]`;

    if (!rule.name || typeof rule.name !== 'string') {
      builder.addError('OBJECT_INVALID_CROSS_PROPERTY_NAME', `${rulePath}.name must be a non-empty string`, rule.name);
    }

    if (!rule.properties || !Array.isArray(rule.properties) || rule.properties.length === 0) {
      builder.addError('OBJECT_INVALID_CROSS_PROPERTY_PROPS', `${rulePath}.properties must be a non-empty array`, rule.properties);
      return;
    }

    const propertyNames = new Set(Object.keys(schema.properties));
    for (const propName of rule.properties) {
      if (!propertyNames.has(propName)) {
        builder.addError('OBJECT_CROSS_PROPERTY_FIELD_NOT_FOUND', `Cross-property validation references undefined property '${propName}'`, { rule: rule.name, propName });
      }
    }

    if (!rule.condition || typeof rule.condition !== 'string') {
      builder.addError('OBJECT_INVALID_CROSS_PROPERTY_CONDITION', `${rulePath}.condition must be a non-empty string`, rule.condition);
    }
  }

  private validateAdditionalPropertiesConstraints(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.additionalProperties === false && schema.patternProperties) {
      builder.addWarning('OBJECT_PATTERN_PROPS_WITH_NO_ADDITIONAL', 'patternProperties defined but additionalProperties is false');
    }

    if (schema.patternProperties) {
      this.validatePatternProperties(schema.patternProperties, builder);
    }
  }

  private validatePatternProperties(patternProperties: DeepReadonly<Record<string, FieldSchema>>, builder: ValidationResultBuilder): void {
    for (const [pattern, schema] of Object.entries(patternProperties)) {
      try {
        new RegExp(pattern);
      } catch (error) {
        builder.addError('OBJECT_INVALID_PATTERN_PROPERTY', `Invalid regex pattern in patternProperties: ${pattern}`, { pattern, error: error instanceof Error ? error.message : 'Unknown error' });
      }

      if (!schema.type) {
        builder.addError('OBJECT_PATTERN_PROPERTY_MISSING_TYPE', `Pattern property schema for '${pattern}' is missing type`, pattern);
      }
    }
  }

  // Security validation
  private validateSensitiveDataHandling(schema: ObjectFieldSchema, builder: ValidationResultBuilder, _context: ValidationContext): void {
    const sensitiveProps = this.findSensitiveProperties(schema);

    if (sensitiveProps.length > 0 && !schema.permissions) {
      builder.addWarning('OBJECT_SENSITIVE_WITHOUT_PERMISSIONS', `Object contains sensitive properties but has no permission configuration: ${sensitiveProps.join(', ')}`, { sensitiveProps });
    }
  }

  private findSensitiveProperties(schema: ObjectFieldSchema): string[] {
    const sensitiveKeywords = ['password', 'secret', 'token', 'key', 'credential', 'ssn', 'credit', 'bank'];

    return Object.keys(schema.properties).filter((propName) => sensitiveKeywords.some((keyword) => propName.toLowerCase().includes(keyword)));
  }

  private validateNestedPermissions(schema: ObjectFieldSchema, builder: ValidationResultBuilder, _context: ValidationContext): void {
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.permissions && !schema.permissions) {
        builder.addInfo('OBJECT_NESTED_PERMISSIONS_WITHOUT_PARENT', `Property '${propName}' has permissions but parent object does not`, propSchema.metadata);
      }
    }
  }

  private validateInheritanceSecurity(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.inheritance?.polymorphic && !schema.discriminator) {
      builder.addWarning('OBJECT_POLYMORPHIC_WITHOUT_DISCRIMINATOR', 'Polymorphic inheritance without discriminator may lead to security issues');
    }
  }

  // Performance validation
  private validateNestingDepth(schema: ObjectFieldSchema, builder: ValidationResultBuilder, context: ValidationContext): void {
    const maxDepth = 15;
    const warningDepth = 10;

    if (context.depth >= maxDepth) {
      builder.addError('OBJECT_EXCESSIVE_NESTING_DEPTH', `Object nesting depth (${context.depth}) exceeds maximum allowed (${maxDepth})`, { depth: context.depth, maxDepth });
    } else if (context.depth >= warningDepth) {
      builder.addWarning('OBJECT_HIGH_NESTING_DEPTH', `Object nesting depth (${context.depth}) is high and may impact performance`, { depth: context.depth });
    }
  }

  private validatePropertyCount(schema: ObjectFieldSchema, builder: ValidationResultBuilder): void {
    const propertyCount = Object.keys(schema.properties).length;
    const maxProperties = 100;
    const warningProperties = 50;

    if (propertyCount > maxProperties) {
      builder.addError('OBJECT_TOO_MANY_PROPERTIES', `Object has too many properties (${propertyCount}). Maximum allowed: ${maxProperties}`, { count: propertyCount, max: maxProperties });
    } else if (propertyCount > warningProperties) {
      builder.addWarning('OBJECT_MANY_PROPERTIES', `Object has many properties (${propertyCount}) which may impact performance`, { count: propertyCount });
    }
  }

  private validateCircularReferences(schema: ObjectFieldSchema, builder: ValidationResultBuilder, context: ValidationContext): void {
    const visited = new Set<string>();
    const currentPath = context.fieldPath || 'root';

    this.detectCircularReferences(schema, visited, currentPath, builder);
  }

  private detectCircularReferences(schema: ObjectFieldSchema, visited: Set<string>, currentPath: string, builder: ValidationResultBuilder): void {
    if (visited.has(currentPath)) {
      builder.addError('OBJECT_CIRCULAR_REFERENCE', `Circular reference detected in object structure at path: ${currentPath}`, { path: currentPath });
      return;
    }

    visited.add(currentPath);

    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (propSchema.type === FieldType.object) {
        const newPath = `${currentPath}.${propName}`;
        this.detectCircularReferences(propSchema as ObjectFieldSchema, new Set(visited), newPath, builder);
      }
    }
  }
}
