import { Injectable } from '@nestjs/common';
import { IsDateString, IsDefined, IsEmail, IsNotEmpty, IsOptional, IsString, IsUrl, IsUUID, Length, Matches } from 'class-validator';
import { v4 as uuidv4 } from 'uuid';
import { BaseFieldProcessor, TransformationFunction } from '../../../core/abstractions/base-field-processor.abstract';
import { AutoGenerateConfig, AutoGenerationType, CaseTransform, StringFieldSchema } from '../../../core/interfaces/schema/primitive/string-field.schema';
import { FieldType } from '../../../core/types/field.types';
import type { FieldSchema } from '../../../core/interfaces/schema';
import { StringFormat } from '../../../core/enums/string.enums';

@Injectable()
export class StringFieldProcessor extends BaseFieldProcessor<StringFieldSchema> {
  readonly supportedType = FieldType.string;

  canProcess(schema: FieldSchema): schema is StringFieldSchema {
    return schema.type === FieldType.string;
  }

  generateValidationDecorators(schema: StringFieldSchema, isRequired: boolean, parentIsArray: boolean): PropertyDecorator[] {
    const decorators: PropertyDecorator[] = [];

    // Required/Optional validation
    if (isRequired) {
      decorators.push(IsDefined(parentIsArray ? { each: true } : undefined));

      if (!schema.nullable) {
        decorators.push(IsNotEmpty(parentIsArray ? { each: true } : undefined));
      }
    } else {
      decorators.push(IsOptional(parentIsArray ? { each: true } : undefined));
    }

    // Type validation
    decorators.push(IsString(parentIsArray ? { each: true } : undefined));

    // Length validation
    if (schema.minLength !== undefined || schema.maxLength !== undefined) {
      const min = schema.minLength ?? 0;
      const max = schema.maxLength ?? Number.MAX_SAFE_INTEGER;
      decorators.push(Length(min, max, parentIsArray ? { each: true } : undefined));
    }

    // Pattern validation
    if (schema.pattern) {
      decorators.push(Matches(new RegExp(schema.pattern), parentIsArray ? { each: true } : undefined));
    }

    // Format validation
    switch (schema.format) {
      case StringFormat.email: {
        decorators.push(IsEmail({}, parentIsArray ? { each: true } : undefined));
        break;
      }
      case StringFormat.url: {
        decorators.push(IsUrl({}, parentIsArray ? { each: true } : undefined));
        break;
      }
      case StringFormat.uuid: {
        decorators.push(IsUUID(undefined, parentIsArray ? { each: true } : undefined));
        break;
      }
      case StringFormat.date: {
        decorators.push(IsDateString({}, parentIsArray ? { each: true } : undefined));
        break;
      }
      // Add more formats as needed TODO: Handle more formats
    }

    return decorators;
  }

  protected getTypeSpecificTransformations(schema: StringFieldSchema): TransformationFunction[] {
    const functions: TransformationFunction[] = [];

    // Auto-generation transformation (order: 30)
    if (schema.autoGenerate) {
      functions.push({
        order: 30,
        name: 'auto_generate',
        transform: ({ value }) => {
          switch (schema.autoGenerate) {
            case AutoGenerationType.uuid:
              return uuidv4();
            case AutoGenerationType.timestamp:
              return new Date().toISOString();
            case AutoGenerationType.random_string:
              return this.generateRandomString(schema.autoGenerateConfig);
            case AutoGenerationType.slug:
              return this.generateSlug(schema.autoGenerateConfig);
            case AutoGenerationType.hash:
              return this.generateHash(schema.autoGenerateConfig);
            default:
              return value;
          }
        },
        condition: (_, { value }) => {
          if (schema.readonly === true) return true;

          return value === undefined;
        },
      });
    }

    // String transformation (order: 40)
    functions.push({
      order: 40,
      name: 'string_processing',
      transform: ({ value }) => {
        if (typeof value !== 'string') return value;

        let result = value;

        if (schema.trimming) {
          const { start = false, end = false, inner = false, chars, preserve = [] } = schema.trimming;

          const escapeRegex = (str: string) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');

          // Build the trim character set
          let trimChars = chars ?? ' \t\n\r';
          if (preserve.length > 0) {
            const preservedChars = preserve.map(escapeRegex).join('');
            trimChars = trimChars
              .split('')
              .filter((c) => !preservedChars.includes(c))
              .join('');
          }

          // Create regex for trimming
          const trimStartRegex = new RegExp(`^[${escapeRegex(trimChars)}]+`, 'g');
          const trimEndRegex = new RegExp(`[${escapeRegex(trimChars)}]+$`, 'g');
          const trimInnerRegex = new RegExp(`[${escapeRegex(trimChars)}]{2,}`, 'g');

          if (start) result = result.replace(trimStartRegex, '');
          if (end) result = result.replace(trimEndRegex, '');
          if (inner) result = result.replace(trimInnerRegex, ' ');
        }

        // Case transformation
        if (schema.caseTransform) {
          result = this.applyCaseTransform(result, schema.caseTransform);
        }

        return result;
      },
      condition: (_, { value }) => typeof value === 'string',
    });

    // Format validation and transformation (order: 50)
    if (schema.format) {
      functions.push({
        order: 50,
        name: 'format_normalization',
        transform: ({ value }) => {
          if (typeof value !== 'string') return value;

          switch (schema.format) {
            case StringFormat.email:
              return value.toLowerCase();
            case StringFormat.url:
              return this.normalizeUrl(value);
            default:
              return value;
          }
        },
        condition: (_, { value }) => typeof value === 'string',
      });
    }

    return functions;
  }

  private generateRandomString(config?: AutoGenerateConfig): string {
    const length = config?.length ?? 8;
    const chars = config?.charset ?? 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private generateSlug(config?: AutoGenerateConfig): string {
    const base = config?.template ?? 'auto-generated';
    return base
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private generateHash(config?: AutoGenerateConfig): string {
    const input = config?.template ?? Date.now().toString();
    return btoa(input)
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, config?.length ?? 16);
  }

  private normalizeUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return parsed.href;
    } catch {
      return url;
    }
  }

  private applyCaseTransform(value: string, transform: CaseTransform): string {
    switch (transform) {
      case CaseTransform.LOWER:
        return value.toLowerCase();
      case CaseTransform.UPPER:
        return value.toUpperCase();
      case CaseTransform.TITLE:
        return value.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase());
      case CaseTransform.SENTENCE:
        return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      case CaseTransform.CAMEL:
        return value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) => (index === 0 ? word.toLowerCase() : word.toUpperCase())).replace(/\s+/g, '');
      case CaseTransform.PASCAL:
        return value.replace(/(?:^\w|[A-Z]|\b\w)/g, (word) => word.toUpperCase()).replace(/\s+/g, '');
      case CaseTransform.SNAKE:
        return value.toLowerCase().replace(/\s+/g, '_');
      case CaseTransform.KEBAB:
        return value.toLowerCase().replace(/\s+/g, '-');
      case CaseTransform.CONSTANT:
        return value.toUpperCase().replace(/\s+/g, '_');
      case CaseTransform.CAPITALIZE_FIRST:
        return value.charAt(0).toUpperCase() + value.slice(1);
      case CaseTransform.CAPITALIZE_WORDS:
        return value.replace(/\b\w/g, (l) => {
          return l.toUpperCase();
        });
      case CaseTransform.NONE:
      default:
        return value;
    }
  }
}
