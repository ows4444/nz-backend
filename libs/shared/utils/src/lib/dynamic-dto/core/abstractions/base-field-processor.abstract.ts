import { Exclude, Expose, Transform } from 'class-transformer';
import { IsNotEmpty, IsOptional, ValidateIf } from 'class-validator';
import type { ConditionalValidation, FieldPermissions, FieldSchema, SerializableCondition } from '../interfaces/schema';
import type { FieldTypeValue } from '../types/field.types';
import type { AutoGenerateConfig } from '../interfaces/schema/primitive/string-field.schema';
import { AutoGenerationType } from '../interfaces/schema/primitive/string-field.schema';
import { ValidationStrategy } from '../enums/validation.enums';

export interface TransformationFunction {
  readonly order: number;
  readonly name: string;
  readonly transform: (params: TransformParams) => unknown;
  readonly condition?: (schema: FieldSchema, params: TransformParams) => boolean;
}

export interface TransformParams {
  value: unknown;
  obj: Record<string, unknown>;
  key: string;
}

export abstract class BaseFieldProcessor<T extends FieldSchema = FieldSchema> {
  abstract readonly supportedType: FieldTypeValue;

  abstract canProcess(schema: FieldSchema): schema is T;
  abstract generateValidationDecorators(schema: T, isRequired: boolean, parentIsArray?: boolean): PropertyDecorator[];

  // New unified transformation system
  public generateTransformationDecorators(schema: T): PropertyDecorator[] {
    const transformFunctions = this.collectTransformationFunctions(schema);

    if (transformFunctions.length === 0) {
      return [];
    }

    return [this.createUnifiedTransform(schema, transformFunctions)];
  }

  // Collect all transformation functions from inheritance chain
  protected collectTransformationFunctions(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // 1. Base transformations (lowest priority)
    functions.push(...this.getBaseTransformations(schema));

    // 2. Type-specific transformations (medium priority)
    functions.push(...this.getTypeSpecificTransformations(schema));

    // 3. Schema-specific transformations (highest priority)
    functions.push(...this.getSchemaSpecificTransformations(schema));

    // Sort by order (lower numbers execute first)
    return functions.sort((a, b) => a.order - b.order);
  }

  // Base transformations available to all field types
  protected getBaseTransformations(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Readonly transformation (order: 10)
    if (schema.readonly) {
      functions.push({
        order: 10,
        name: 'readonly',
        transform: ({ value, obj, key }) => obj?.[key] ?? value,
      });
    }

    // Default/auto-generation transformation (order: 20)
    if (schema.default !== undefined) {
      functions.push({
        order: 20,
        name: 'default_value',
        transform: ({ value, obj }) => {
          if (value !== undefined) return value;

          if (typeof schema.default === 'string' && schema.default.startsWith('${')) {
            return this.evaluateExpression(schema.default, obj);
          }

          return schema.default;
        },
        condition: (_, { value }) => value === undefined,
      });
    }

    return functions;
  }

  // Abstract method for type-specific transformations
  protected abstract getTypeSpecificTransformations(schema: T): TransformationFunction[];

  // Schema-specific transformations (hooks, custom validators, etc.)
  protected getSchemaSpecificTransformations(schema: T): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Custom transformation hooks (order: 100+)
    if ('transformationHooks' in schema && Array.isArray(schema.transformationHooks)) {
      schema.transformationHooks.forEach((hook, index) => {
        functions.push({
          order: 100 + index,
          name: `custom_hook_${index}`,
          transform: ({ value, obj }) => this.executeHook(hook.id, value, obj),
          condition: hook.condition ? (_, params) => this.evaluateCondition(hook.condition, params.obj) : undefined,
        });
      });
    }

    return functions;
  }

  protected createUnifiedTransform(schema: T, transformFunctions: TransformationFunction[]): PropertyDecorator {
    return Transform(({ value, obj, key }: TransformParams) => {
      const params = { value, obj, key };
      let currentValue = value;

      for (const fn of transformFunctions) {
        try {
          // Check condition if provided
          if (fn.condition && !fn.condition(schema, { ...params, value: currentValue })) {
            continue;
          }

          // Apply transformation
          const newValue = fn.transform({ ...params, value: currentValue });

          // Update current value for next transformation
          if (newValue !== undefined) {
            currentValue = newValue;
          }
        } catch (error) {
          console.warn(`Transformation '${fn.name}' failed:`, error);
        }
      }

      return currentValue;
    });
  }

  // Serialization decorators (unchanged)
  public generateSerializationDecorators(schema: T, isRequired: boolean, excludeAll: boolean, context?: SerializationContext): PropertyDecorator[] {
    if (this.shouldExcludeForPermissions(schema, context)) return [Exclude()];
    if (this.shouldExcludeForHidden(schema, context)) return [Exclude()];
    if (this.shouldExcludeForDeprecated(schema, context)) return [Exclude()];

    const decorators: PropertyDecorator[] = [];

    if ((excludeAll && schema.expose) || isRequired) decorators.push(Expose());
    if (!excludeAll && schema.exclude) decorators.push(Exclude());

    return decorators;
  }

  // Enhanced validation decorators
  public generateEnhancedValidationDecorators(schema: T, isRequired: boolean): PropertyDecorator[] {
    const decorators = [...this.generateValidationDecorators(schema, isRequired), ...this.generateConditionalValidationDecorators(schema)];

    if (schema.nullable) decorators.push(...this.createNullableValidation());
    if (isRequired && !schema.readonly) decorators.push(IsNotEmpty({ message: this.getValidationMessage(schema, 'required') }));
    else if (!isRequired) decorators.push(IsOptional());

    if ('customValidators' in schema && schema.customValidators?.length) {
      decorators.push(...this.generateCustomValidationDecorators(schema.customValidators));
    }

    decorators.push(...this.generateValidationStrategyDecorators(schema));
    return decorators;
  }

  public generateConditionalValidationDecorators(schema: T): PropertyDecorator[] {
    if (!('conditionalValidation' in schema) || !schema.conditionalValidation) return [];
    return (schema.conditionalValidation as ConditionalValidation[]).map((condition) => this.createConditionalValidator(condition));
  }

  // Utility methods
  protected shouldExcludeForPermissions(schema: T, context?: SerializationContext): boolean {
    if (!context?.userRoles || !('permissions' in schema) || !schema.permissions) return false;
    return !this.checkOperationPermission(schema.permissions, context.userRoles, context.operation);
  }

  protected shouldExcludeForHidden(schema: T, context?: SerializationContext): boolean {
    return !!('displayHints' in schema && schema.displayHints?.hidden) && !context?.includeHidden;
  }

  protected shouldExcludeForDeprecated(schema: T, context?: SerializationContext): boolean {
    return !!('deprecated' in schema && schema.deprecated) && !context?.includeDeprecated;
  }

  protected checkOperationPermission(permissions: FieldPermissions, userRoles: string[], operation?: 'create' | 'read' | 'update' | 'delete'): boolean {
    if (!userRoles?.length) return false;

    const roleMap = {
      create: permissions.create ?? permissions.write ?? [],
      read: permissions.read ?? [],
      update: permissions.update ?? permissions.write ?? [],
      delete: permissions.delete ?? permissions.write ?? [],
    };

    const requiredRoles = roleMap[operation ?? 'read'] ?? [];
    return this.checkPermission(requiredRoles, userRoles);
  }

  protected checkPermission(allowedRoles?: readonly string[], userRoles?: readonly string[]): boolean {
    if (!allowedRoles?.length) return true;
    return allowedRoles.some((role) => userRoles?.includes(role));
  }

  protected createNullableValidation(): PropertyDecorator[] {
    return [ValidateIf((_, val) => val !== null)];
  }

  protected generateAutoValue(type: AutoGenerationType, _config?: AutoGenerateConfig): unknown {
    const generators = {
      [AutoGenerationType.uuid]: 'AUTO_UUID',
      [AutoGenerationType.timestamp]: 'AUTO_TIMESTAMP',
      [AutoGenerationType.incremental]: 'AUTO_INCREMENTAL',
      [AutoGenerationType.slug]: 'AUTO_SLUG',
      [AutoGenerationType.hash]: 'AUTO_HASH',
      [AutoGenerationType.random_string]: 'AUTO_RANDOM_STRING',
      [AutoGenerationType.sequence]: 'AUTO_SEQUENCE',
    };
    return generators[type];
  }

  protected evaluateExpression(expression: string, _context: Record<string, unknown>): unknown {
    return `EXPR:${expression}`;
  }

  protected executeHook(_hookId: string, value: unknown, _context: Record<string, unknown>): unknown {
    return value;
  }

  protected generateCustomValidationDecorators(customValidators: readonly string[]): PropertyDecorator[] {
    return customValidators.map(() => ValidateIf(() => true));
  }

  protected generateValidationStrategyDecorators(schema: T): PropertyDecorator[] {
    if (!('validationStrategy' in schema)) return [];

    switch (schema.validationStrategy) {
      case ValidationStrategy.loose:
        return [IsOptional()];
      case ValidationStrategy.strict:
      case ValidationStrategy.transform:
      case ValidationStrategy.sanitize:
      default:
        return [];
    }
  }

  protected createConditionalValidator(condition: ConditionalValidation): PropertyDecorator {
    return ValidateIf((obj) => this.evaluateCondition(condition.condition, obj));
  }

  protected evaluateCondition(condition: SerializableCondition, obj: Record<string, unknown>): boolean {
    const value = this.getNestedValue(obj, condition.field);
    let result = this.evaluateSingleCondition(condition, value);

    if ('nested' in condition && condition.nested?.length) {
      const nestedResults = condition.nested.map((n) => this.evaluateCondition(n, obj));
      result = condition.logicalOperator === 'and' ? result && nestedResults.every(Boolean) : result || nestedResults.some(Boolean);
    }

    return result;
  }

  protected evaluateSingleCondition(condition: SerializableCondition, value: unknown): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'ne':
        return value !== condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'gte':
        return Number(value) >= Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'lte':
        return Number(value) <= Number(condition.value);
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'exists':
        return value != null;
      case 'regex':
        return new RegExp(String(condition.value)).test(String(value));
      default:
        return true;
    }
  }

  protected getValidationMessage(schema: T, type: string): string {
    return `Field ${schema.type} validation failed for ${type}`;
  }

  protected getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((val, key) => val?.[key], obj);
  }
}

export interface SerializationContext {
  userRoles?: string[];
  operation?: 'create' | 'read' | 'update' | 'delete';
  includeHidden?: boolean;
  includeDeprecated?: boolean;
  locale?: string;
  userId?: string;
  version?: string;
}
