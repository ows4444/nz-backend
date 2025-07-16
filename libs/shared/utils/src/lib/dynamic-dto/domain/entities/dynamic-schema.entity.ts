import type { FieldSchema } from '../../core/interfaces/schema';
import type { SchemaVersion } from '../value-objects/schema-version.vo';

export class DynamicSchemaEntity {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly properties: Record<string, FieldSchema>,
    public readonly version: SchemaVersion,
    public readonly required: string[] = [],
    public readonly excludeAll = false,
    public readonly metadata?: Record<string, unknown>,
  ) {}

  public evolve(newProperties: Record<string, FieldSchema>, newVersion: SchemaVersion): DynamicSchemaEntity {
    return new DynamicSchemaEntity(this.id, this.name, { ...this.properties, ...newProperties }, newVersion, this.required, this.excludeAll, this.metadata);
  }

  public isCompatibleWith(other: DynamicSchemaEntity): boolean {
    return this.version.isCompatibleWith(other.version);
  }

  public getRequiredFields(): string[] {
    return [...this.required];
  }

  public hasField(fieldName: string): boolean {
    return fieldName in this.properties;
  }
}
