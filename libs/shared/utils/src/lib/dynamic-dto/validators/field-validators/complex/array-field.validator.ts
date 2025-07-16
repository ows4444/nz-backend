import { Injectable } from '@nestjs/common';
import {
  ArrayFieldSchema,
  BaseFieldSchema,
  BaseFieldValidator,
  CrossItemValidationRule,
  FieldSchema,
  SortConfig,
  StringFormat,
  ValidationContext,
  ValidationResult,
  ValidationResultBuilder,
  ValidationRule,
  ValidationSeverity,
} from '../../../core';
import { FieldType, FieldTypeValue } from '../../../core/types/field.types';

@Injectable()
export class ArrayFieldValidator extends BaseFieldValidator<ArrayFieldSchema> {
  readonly supportedType = FieldType.array;
  readonly priority = 100;
  readonly name = 'ArrayFieldValidator';

  canValidate(schema: BaseFieldSchema): schema is ArrayFieldSchema {
    return schema.type === FieldType.array;
  }

  validateStructure(schema: ArrayFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateItemsStructure(schema, builder);
    this.validateSizeConstraints(schema, builder);
    this.validateSortConfiguration(schema, builder);
    this.validateUniquenessConfiguration(schema, builder);

    return builder.build();
  }

  validateConstraints(schema: ArrayFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateSizeConstraintLogic(schema, builder);
    this.validateItemValidationRules(schema, builder, context);
    this.validateCrossItemValidation(schema, builder);
    this.validateConflictingConstraints(schema, builder);

    return builder.build();
  }

  protected validateSecurity(schema: ArrayFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validateSecurityConstraints(schema, builder);
    this.validateItemSecurityPropagation(schema, builder, context);

    return builder.build();
  }

  protected validatePerformance(schema: ArrayFieldSchema, context: ValidationContext): ValidationResult {
    const builder = new ValidationResultBuilder(context.fieldPath);

    this.validatePerformanceConstraints(schema, builder);
    this.validateNestedComplexity(schema, builder, context);

    return builder.build();
  }

  // Structure validation methods
  private validateItemsStructure(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.items) {
      builder.addError('ARRAY_MISSING_ITEMS', 'Array schema must define items');
      return;
    }

    if (Array.isArray(schema.items)) {
      this.validateTupleItems(schema.items, builder);
    } else {
      this.validateSingleItemType(schema.items, builder);
    }
  }

  private validateTupleItems(items: FieldSchema[], builder: ValidationResultBuilder): void {
    if (items.length === 0) {
      builder.addWarning('ARRAY_EMPTY_TUPLE', 'Tuple array has no items defined');
      return;
    }

    items.forEach((item, index) => {
      if (!item.type) {
        builder.addError('ARRAY_TUPLE_ITEM_MISSING_TYPE', `Tuple item at index ${index} is missing type`, index);
      }

      if (!this.isValidFieldType(item.type)) {
        builder.addError('ARRAY_TUPLE_ITEM_INVALID_TYPE', `Tuple item at index ${index} has invalid type: ${item.type}`, { index, type: item.type });
      }
    });
  }

  private validateSingleItemType(item: FieldSchema, builder: ValidationResultBuilder): void {
    if (!item.type) {
      builder.addError('ARRAY_ITEM_MISSING_TYPE', 'Array item schema is missing type');
      return;
    }

    if (!this.isValidFieldType(item.type)) {
      builder.addError('ARRAY_ITEM_INVALID_TYPE', `Array item has invalid type: ${item.type}`, item.type);
    }

    // Validate circular reference prevention
    if (item.type === FieldType.array) {
      builder.addWarning('ARRAY_NESTED_ARRAY', 'Nested arrays can impact performance and complexity');
    }
  }

  private validateSizeConstraints(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.minItems !== undefined && schema.minItems < 0) {
      builder.addError('ARRAY_INVALID_MIN_ITEMS', 'minItems must be non-negative', schema.minItems);
    }

    if (schema.maxItems !== undefined && schema.maxItems < 0) {
      builder.addError('ARRAY_INVALID_MAX_ITEMS', 'maxItems must be non-negative', schema.maxItems);
    }
  }

  private validateSortConfiguration(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.sortable && schema.sortBy) {
      builder.addWarning('ARRAY_SORT_CONFIG_WITHOUT_SORTABLE', 'sortBy specified but array is not marked as sortable');
    }

    if (schema.defaultSort) {
      this.validateDefaultSort(schema.defaultSort, builder);
    }
  }

  private validateDefaultSort(sortConfig: SortConfig, builder: ValidationResultBuilder): void {
    if (!sortConfig.field) {
      builder.addError('ARRAY_SORT_MISSING_FIELD', 'Default sort configuration missing field');
    }

    if (!['asc', 'desc'].includes(sortConfig.direction)) {
      builder.addError('ARRAY_SORT_INVALID_DIRECTION', `Invalid sort direction: ${sortConfig.direction}`, sortConfig.direction);
    }
  }

  private validateUniquenessConfiguration(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.uniqueBy && !schema.uniqueItems) {
      builder.addInfo('ARRAY_UNIQUE_BY_WITHOUT_UNIQUE_ITEMS', 'uniqueBy specified without uniqueItems flag');
    }

    if (Array.isArray(schema.uniqueBy)) {
      schema.uniqueBy.forEach((field, index) => {
        if (typeof field !== 'string' || !field.trim()) {
          builder.addError('ARRAY_INVALID_UNIQUE_BY_FIELD', `Invalid uniqueBy field at index ${index}`, { index, field });
        }
      });
    }
  }

  // Constraint validation methods
  private validateSizeConstraintLogic(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (schema.minItems !== undefined && schema.maxItems !== undefined) {
      if (schema.minItems > schema.maxItems) {
        builder.addError('ARRAY_INVALID_SIZE_RANGE', `minItems (${schema.minItems}) cannot be greater than maxItems (${schema.maxItems})`, { minItems: schema.minItems, maxItems: schema.maxItems });
      }
    }

    // Validate against tuple length if applicable
    if (Array.isArray(schema.items) && schema.minItems !== undefined) {
      if (schema.minItems > schema.items.length) {
        builder.addError('ARRAY_MIN_ITEMS_EXCEEDS_TUPLE_LENGTH', `minItems (${schema.minItems}) exceeds tuple length (${schema.items.length})`, {
          minItems: schema.minItems,
          tupleLength: schema.items.length,
        });
      }
    }
  }

  private validateItemValidationRules(schema: ArrayFieldSchema, builder: ValidationResultBuilder, context: ValidationContext): void {
    if (!schema.itemValidation?.length) return;

    schema.itemValidation.forEach((rule, index) => {
      this.validateSingleValidationRule(rule, index, builder, context);
    });
  }

  private validateSingleValidationRule(rule: ValidationRule, index: number, builder: ValidationResultBuilder, _context: ValidationContext): void {
    if (!rule.type) {
      builder.addError('ARRAY_ITEM_VALIDATION_MISSING_TYPE', `Item validation rule at index ${index} is missing type`, index);
    }

    if (rule.severity && !Object.values(ValidationSeverity).includes(rule.severity)) {
      builder.addError('ARRAY_ITEM_VALIDATION_INVALID_SEVERITY', `Item validation rule at index ${index} has invalid severity: ${rule.severity}`, { index, severity: rule.severity });
    }
  }

  private validateCrossItemValidation(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    if (!schema.crossItemValidation?.length) return;

    schema.crossItemValidation.forEach((rule, index) => {
      this.validateCrossItemRule(rule, index, builder);
    });
  }

  private validateCrossItemRule(rule: CrossItemValidationRule, index: number, builder: ValidationResultBuilder): void {
    if (!rule.name) {
      builder.addError('ARRAY_CROSS_ITEM_VALIDATION_MISSING_NAME', `Cross-item validation rule at index ${index} is missing name`, index);
    }

    if (!rule.condition) {
      builder.addError('ARRAY_CROSS_ITEM_VALIDATION_MISSING_CONDITION', `Cross-item validation rule at index ${index} is missing condition`, index);
    }

    if (rule.severity && !Object.values(ValidationSeverity).includes(rule.severity)) {
      builder.addError('ARRAY_CROSS_ITEM_VALIDATION_INVALID_SEVERITY', `Cross-item validation rule at index ${index} has invalid severity: ${rule.severity}`, { index, severity: rule.severity });
    }
  }

  private validateConflictingConstraints(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    // Check for conflicting uniqueness constraints
    if (schema.uniqueItems && Array.isArray(schema.items)) {
      builder.addWarning('ARRAY_UNIQUE_ITEMS_WITH_TUPLE', 'uniqueItems constraint may not work as expected with tuple arrays');
    }

    // Check for performance implications
    if (schema.uniqueItems && schema.maxItems && schema.maxItems > 1000) {
      builder.addWarning('ARRAY_LARGE_UNIQUE_ARRAY', 'Large arrays with uniqueItems constraint may have performance implications');
    }
  }

  // Security validation methods
  private validateSecurityConstraints(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    const maxSafeSize = 10000;

    if (schema.maxItems && schema.maxItems > maxSafeSize) {
      builder.addWarning('ARRAY_POTENTIALLY_UNSAFE_SIZE', `Array maxItems (${schema.maxItems}) exceeds recommended safe size (${maxSafeSize})`, { maxItems: schema.maxItems, safeSize: maxSafeSize });
    }

    if (!schema.maxItems) {
      builder.addWarning('ARRAY_UNBOUNDED_SIZE', 'Array has no maxItems constraint, which could lead to memory issues');
    }
  }

  private validateItemSecurityPropagation(schema: ArrayFieldSchema, builder: ValidationResultBuilder, _context: ValidationContext): void {
    if (Array.isArray(schema.items)) return;

    const itemSchema = schema.items;

    // Check if sensitive data in items needs special handling
    if (this.containsSensitiveData(itemSchema)) {
      builder.addInfo('ARRAY_CONTAINS_SENSITIVE_DATA', 'Array contains items with potentially sensitive data');
    }
  }

  // Performance validation methods
  private validatePerformanceConstraints(schema: ArrayFieldSchema, builder: ValidationResultBuilder): void {
    const performanceThreshold = 1000;

    if (schema.maxItems && schema.maxItems > performanceThreshold) {
      builder.addInfo('ARRAY_PERFORMANCE_CONSIDERATION', `Large array (maxItems: ${schema.maxItems}) may impact performance`, schema.metadata);
    }

    if (schema.crossItemValidation?.length && schema.maxItems && schema.maxItems > 100) {
      builder.addWarning('ARRAY_CROSS_VALIDATION_PERFORMANCE', 'Cross-item validation on large arrays may be expensive');
    }
  }

  private validateNestedComplexity(schema: ArrayFieldSchema, builder: ValidationResultBuilder, context: ValidationContext): void {
    if (context.depth > 5) {
      builder.addWarning('ARRAY_DEEP_NESTING', `Array at depth ${context.depth} may impact performance`);
    }

    if (!Array.isArray(schema.items) && schema.items.type === FieldType.object) {
      builder.addInfo('ARRAY_COMPLEX_OBJECTS', 'Array of objects may require additional performance considerations');
    }
  }

  // Utility methods
  private isValidFieldType(type: FieldTypeValue): boolean {
    return Object.values(FieldType).includes(type);
  }

  private containsSensitiveData(schema: FieldSchema): boolean {
    // Check for potentially sensitive field types or formats
    if (schema.type === FieldType.string) {
      const stringSchema = schema;
      const sensitiveFormats: StringFormat[] = ['password', 'credit_card', 'email'];
      return sensitiveFormats.includes(stringSchema.format!);
    }

    // Note: FILE type was removed from supported field types

    return false;
  }
}
