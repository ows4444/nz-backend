import { ConfigurableModuleBuilder } from '@nestjs/common';
import type { DynamicDtoModuleOptions } from './interfaces/module-options.interface';

export const { ConfigurableModuleClass, MODULE_OPTIONS_TOKEN } = new ConfigurableModuleBuilder<DynamicDtoModuleOptions>({
  moduleName: 'DynamicDto',
})
  .setExtras({ isGlobal: false }, (definition, extras) => ({ ...definition, global: extras.isGlobal }))
  .build();
