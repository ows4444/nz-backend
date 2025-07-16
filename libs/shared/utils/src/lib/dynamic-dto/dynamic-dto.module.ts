import { DynamicModule, Module, Provider } from '@nestjs/common';

// Core services
import { DtoOrchestratorService } from './application/services/dto-orchestrator.service';
import { SchemaOrchestratorService } from './application/services/schema-orchestrator.service';

// Pipelines
import { DtoGenerationPipeline } from './application/pipelines/dto-generation.pipeline';
import { ValidationPipeline } from './application/pipelines/validation.pipeline';
import { SchemaValidationPipeline } from './application/pipelines/schema-validation.pipeline';

// Infrastructure
import { CacheManagerService } from './infrastructure/cache/cache-manager.service';
import { MemoryCacheStrategy } from './infrastructure/cache/strategies/memory-cache.strategy';

// Registries (refactored to avoid circular dependencies)
import { FieldProcessorRegistry } from './infrastructure/registries/field-processor.registry';
import { FieldValidatorRegistry } from './infrastructure/registries/field-validator.registry';

// Schema Validators
import { EnhancedStructuralSchemaValidator } from './validators/schema-validators/enhanced-structural-schema.validator';
import { BaseSchemaValidator } from './core/abstractions/base-schema-validator.abstract';

// Field Processors - Factory pattern to handle circular deps
import { createFieldProcessorProviders } from './infrastructure/factories/field-processor.factory';
import { createFieldValidatorProviders } from './infrastructure/factories/field-validator.factory';

// Configuration
import { DynamicDtoModuleOptions } from './interfaces/module-options.interface';
import { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } from './dynamic-dto.module-definition';

// Services
import { ValidationErrorRecoveryService, ValidationErrorService } from './exceptions/validation';
import { NestedClassGeneratorService } from './infrastructure/services/nested-class-generator.service';

@Module({})
export class DynamicDtoModule extends ConfigurableModuleClass {
  static forRoot(options: DynamicDtoModuleOptions = {}): DynamicModule {
    const cacheProviders = this.createCacheProviders(options);
    const fieldProcessorProviders = createFieldProcessorProviders();
    const fieldValidatorProviders = createFieldValidatorProviders();

    return {
      module: DynamicDtoModule,
      global: options.isGlobal ?? false,
      imports: [...(options.imports ?? [])],
      providers: [
        // Module options
        {
          provide: MODULE_OPTIONS_TOKEN,
          useValue: options,
        },

        // Core Application Services
        DtoOrchestratorService,
        SchemaOrchestratorService,

        // Pipelines
        DtoGenerationPipeline,
        ValidationPipeline,
        SchemaValidationPipeline,

        // Infrastructure Services
        ...cacheProviders,

        // Registries
        FieldProcessorRegistry,
        FieldValidatorRegistry,

        // Schema Validators
        EnhancedStructuralSchemaValidator,
        {
          provide: BaseSchemaValidator,
          useClass: EnhancedStructuralSchemaValidator,
        },

        // Field Processors and Validators
        ...fieldProcessorProviders,
        ...fieldValidatorProviders,

        // Validation services
        ValidationErrorService,
        ValidationErrorRecoveryService,

        // Infrastructure services
        NestedClassGeneratorService,
      ],
      exports: [DtoOrchestratorService, NestedClassGeneratorService, SchemaOrchestratorService, FieldProcessorRegistry, FieldValidatorRegistry, SchemaValidationPipeline],
    };
  }

  private static createCacheProviders(_options: DynamicDtoModuleOptions): Provider[] {
    return [
      {
        provide: 'ICacheStrategy',
        useClass: MemoryCacheStrategy,
      },
      CacheManagerService,
      {
        provide: 'ICacheManager',
        useClass: CacheManagerService,
      },
    ];
  }
}
