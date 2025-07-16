import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ICacheManager } from '../../core/interfaces/cache/cache-manager.interface';
import { DynamicSchemaEntity } from '../../domain/entities/dynamic-schema.entity';
import { DtoGenerationPipeline } from '../pipelines/dto-generation.pipeline';
import { ValidationPipeline } from '../pipelines/validation.pipeline';
import type { ClassConstructor } from '../../core/types/common.types';
import { MODULE_OPTIONS_TOKEN } from '../../dynamic-dto.module-definition';
import type { DynamicDtoModuleOptions } from '../../interfaces/module-options.interface';

@Injectable()
export class DtoOrchestratorService {
  private readonly logger = new Logger(DtoOrchestratorService.name);

  constructor(
    private readonly validationPipeline: ValidationPipeline,
    private readonly generationPipeline: DtoGenerationPipeline,
    @Inject('ICacheManager') private readonly cacheManager: ICacheManager,
    @Inject(MODULE_OPTIONS_TOKEN) private readonly options: DynamicDtoModuleOptions,
  ) {}

  async generateDto(schema: DynamicSchemaEntity): Promise<ClassConstructor<object>> {
    const startTime = Date.now();

    try {
      // Generate cache key
      const cacheKey = this.generateCacheKey(schema);

      // Check cache first
      const cached = await this.cacheManager.get<ClassConstructor<object>>(cacheKey);
      if (cached) {
        return cached;
      }

      // Validate schema
      const validationResult = this.validationPipeline.validate(schema);
      if (!validationResult.isValid) {
        this.logger.error('Schema validation failed', {
          schemaId: schema.id,
          errors: validationResult.errors,
        });
        throw new Error(`Schema validation failed: ${JSON.stringify(validationResult.errors)}`);
      }

      // Generate DTO
      const generatedClass = await this.generationPipeline.generateAsync(schema);

      // Cache result
      const ttl = this.options.cache?.ttl ?? 3600; // 1 hour default
      await this.cacheManager.set(cacheKey, generatedClass, ttl);

      // Record performance metrics
      const duration = Date.now() - startTime;

      this.logger.log('DTO generated successfully', {
        schemaId: schema.id,
        duration,
      });

      return generatedClass;
    } catch (error) {
      const duration = Date.now() - startTime;

      this.logger.error('DTO generation failed', {
        schemaId: schema.id,
        duration,
        error: error.message,
      });

      throw error;
    }
  }

  async validateData(
    data: unknown,
    schema: DynamicSchemaEntity,
  ): Promise<{ isValid: boolean; errors: { property?: string; value?: unknown; constraints?: Record<string, string>; message?: string }[] }> {
    const DtoClass = await this.generateDto(schema);

    try {
      const { plainToInstance } = await import('class-transformer');
      const { validate } = await import('class-validator');

      const dto = plainToInstance(DtoClass, data);
      const errors = await validate(dto);

      return {
        isValid: errors.length === 0,
        errors: errors.map((error) => ({
          property: error.property,
          value: error.value,
          constraints: error.constraints,
        })),
      };
    } catch (error) {
      this.logger.error('Data validation failed', {
        schemaId: schema.id,
        error: error.message,
      });

      return {
        isValid: false,
        errors: [{ message: error.message }],
      };
    }
  }

  private generateCacheKey(schema: DynamicSchemaEntity): string {
    return `dto:${schema.name}:${schema.version.toString()}`;
  }
}
