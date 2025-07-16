import type { ModuleMetadata } from '@nestjs/common';

export interface DynamicDtoModuleOptions {
  isGlobal?: boolean;
  imports?: ModuleMetadata['imports'];
  cache?: {
    ttl?: number;
  };
  validation?: {
    enableCrossFieldValidation?: boolean;
    maxNestingDepth?: number;
    performanceMode?: 'strict' | 'optimized';
  };
}
