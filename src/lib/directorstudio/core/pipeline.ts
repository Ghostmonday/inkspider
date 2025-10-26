// MODULE: DirectorStudio Pipeline Engine
// VERSION: 1.0.0
// PURPOSE: Core pipeline execution engine for DirectorStudio modules

import { PipelineModule, DirectorStudioConfig, ValidationResult } from './types';
import { logEvent, logMetrics, logError } from './telemetry';
import { DirectorStudioValidator } from './validator';
import { ContinuityEngine } from './continuity';

export class PipelineEngine {
  private static instance: PipelineEngine;
  private modules: Map<string, PipelineModule> = new Map();
  private config: DirectorStudioConfig;
  private validator: DirectorStudioValidator;
  private continuity: ContinuityEngine;
  private isInitialized: boolean = false;

  private constructor(config: DirectorStudioConfig) {
    this.config = config;
    this.validator = DirectorStudioValidator.getInstance(config.validation);
    this.continuity = ContinuityEngine.getInstance(config.continuity);
  }

  public static getInstance(config?: DirectorStudioConfig): PipelineEngine {
    if (!PipelineEngine.instance) {
      if (!config) {
        throw new Error('PipelineEngine must be initialized with configuration');
      }
      PipelineEngine.instance = new PipelineEngine(config);
    }
    return PipelineEngine.instance;
  }

  /**
   * Initialize the pipeline engine
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      logEvent('pipeline_already_initialized', 'PipelineEngine', {});
      return;
    }

    logEvent('pipeline_initialization_started', 'PipelineEngine', {
      moduleCount: this.modules.size
    });

    try {
      // Initialize all modules in dependency order
      const sortedModules = this.sortModulesByDependencies();
      
      for (const module of sortedModules) {
        if (module.config.enabled) {
          await this.initializeModule(module);
        }
      }

      this.isInitialized = true;
      
      logEvent('pipeline_initialization_completed', 'PipelineEngine', {
        initializedModules: sortedModules.length
      });
    } catch (error) {
      logError('PipelineEngine', error as Error, { operation: 'initialize' });
      throw error;
    }
  }

  /**
   * Register a module with the pipeline
   */
  public registerModule(module: PipelineModule): void {
    // Validate module structure before registration
    this.validator.validateStructure(module).then(result => {
      if (!result.isValid) {
        logError('PipelineEngine', new Error('Module validation failed'), {
          module: module.name,
          errors: result.errors
        });
        throw new Error(`Module ${module.name} failed validation`);
      }
    });

    this.modules.set(module.name, module);
    
    logEvent('module_registered', 'PipelineEngine', {
      module: module.name,
      version: module.version,
      dependencies: module.dependencies
    });
  }

  /**
   * Unregister a module from the pipeline
   */
  public unregisterModule(moduleName: string): void {
    if (this.modules.has(moduleName)) {
      const module = this.modules.get(moduleName)!;
      
      // Cleanup module before removal
      module.cleanup().catch(error => {
        logError('PipelineEngine', error as Error, {
          module: moduleName,
          operation: 'cleanup'
        });
      });

      this.modules.delete(moduleName);
      
      logEvent('module_unregistered', 'PipelineEngine', {
        module: moduleName
      });
    }
  }

  /**
   * Process data through the pipeline
   */
  public async process(
    input: any,
    sessionId: string,
    userId?: string
  ): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Pipeline not initialized');
    }

    const startTime = Date.now();
    let currentData = input;

    logEvent('pipeline_processing_started', 'PipelineEngine', {
      sessionId,
      userId,
      inputType: typeof input
    });

    try {
      // Get continuity context
      const context = this.continuity.getContext(sessionId, userId);
      
      // Update context with processing start
      this.continuity.updateState(sessionId, {
        'pipeline:processing': true,
        'pipeline:startTime': startTime,
        'pipeline:input': input
      }, 'PipelineEngine');

      // Process through modules in priority order
      const sortedModules = this.getModulesByPriority();
      
      for (const module of sortedModules) {
        if (!module.config.enabled) continue;

        const moduleStartTime = Date.now();
        
        try {
          // Validate module before processing
          const validationResult = await this.validator.validateModule(module);
          if (!validationResult.isValid && this.config.validation.strictMode) {
            throw new Error(`Module ${module.name} validation failed`);
          }

          // Process data through module
          currentData = await module.process(currentData);
          
          const moduleExecutionTime = Date.now() - moduleStartTime;
          
          // Log metrics
          logMetrics(module.name, {
            executionTime: moduleExecutionTime,
            memoryUsage: 0, // Would be calculated in real implementation
            cpuUsage: 0,    // Would be calculated in real implementation
            throughput: 1   // Would be calculated based on data size
          });

          // Update continuity context
          this.continuity.updateState(sessionId, {
            [`${module.name}:lastProcessed`]: new Date(),
            [`${module.name}:executionTime`]: moduleExecutionTime
          }, module.name);

          // Add event to history
          this.continuity.addEvent(sessionId, 'module_processed', {
            module: module.name,
            executionTime: moduleExecutionTime,
            dataSize: JSON.stringify(currentData).length
          }, module.name);

        } catch (error) {
          logError('PipelineEngine', error as Error, {
            module: module.name,
            sessionId,
            userId
          });
          
          // Update context with error
          this.continuity.updateState(sessionId, {
            [`${module.name}:error`]: error instanceof Error ? error.message : 'Unknown error',
            [`${module.name}:errorTime`]: new Date()
          }, module.name);

          if (this.config.validation.strictMode) {
            throw error;
          }
        }
      }

      const totalExecutionTime = Date.now() - startTime;
      
      // Update final context state
      this.continuity.updateState(sessionId, {
        'pipeline:processing': false,
        'pipeline:completed': true,
        'pipeline:totalTime': totalExecutionTime,
        'pipeline:output': currentData
      }, 'PipelineEngine');

      logEvent('pipeline_processing_completed', 'PipelineEngine', {
        sessionId,
        userId,
        totalExecutionTime,
        outputType: typeof currentData
      });

      return currentData;

    } catch (error) {
      const totalExecutionTime = Date.now() - startTime;
      
      logError('PipelineEngine', error as Error, {
        sessionId,
        userId,
        totalExecutionTime
      });

      // Update context with error
      this.continuity.updateState(sessionId, {
        'pipeline:error': error instanceof Error ? error.message : 'Unknown error',
        'pipeline:errorTime': new Date(),
        'pipeline:processing': false
      }, 'PipelineEngine');

      throw error;
    }
  }

  /**
   * Get all registered modules
   */
  public getModules(): PipelineModule[] {
    return Array.from(this.modules.values());
  }

  /**
   * Get module by name
   */
  public getModule(name: string): PipelineModule | undefined {
    return this.modules.get(name);
  }

  /**
   * Validate all modules
   */
  public async validateAllModules(): Promise<Map<string, ValidationResult>> {
    const results = new Map<string, ValidationResult>();
    
    for (const [name, module] of this.modules) {
      const result = await this.validator.validateModule(module);
      results.set(name, result);
    }

    return results;
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<DirectorStudioConfig>): void {
    this.config = { ...this.config, ...config };
    
    // Update sub-components
    this.validator.updateConfig(config.validation || {});
    this.continuity.updateConfig(config.continuity || {});
  }

  /**
   * Get current configuration
   */
  public getConfig(): DirectorStudioConfig {
    return { ...this.config };
  }

  /**
   * Shutdown the pipeline engine
   */
  public async shutdown(): Promise<void> {
    logEvent('pipeline_shutdown_started', 'PipelineEngine', {});

    // Cleanup all modules
    for (const [name, module] of this.modules) {
      try {
        await module.cleanup();
        logEvent('module_cleanup_completed', 'PipelineEngine', { module: name });
      } catch (error) {
        logError('PipelineEngine', error as Error, {
          module: name,
          operation: 'cleanup'
        });
      }
    }

    // Clear modules
    this.modules.clear();
    this.isInitialized = false;

    logEvent('pipeline_shutdown_completed', 'PipelineEngine', {});
  }

  private async initializeModule(module: PipelineModule): Promise<void> {
    try {
      await module.initialize();
      logEvent('module_initialized', 'PipelineEngine', {
        module: module.name,
        version: module.version
      });
    } catch (error) {
      logError('PipelineEngine', error as Error, {
        module: module.name,
        operation: 'initialize'
      });
      throw error;
    }
  }

  private sortModulesByDependencies(): PipelineModule[] {
    const modules = Array.from(this.modules.values());
    const sorted: PipelineModule[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (module: PipelineModule) => {
      if (visiting.has(module.name)) {
        throw new Error(`Circular dependency detected involving module: ${module.name}`);
      }
      if (visited.has(module.name)) {
        return;
      }

      visiting.add(module.name);

      // Visit dependencies first
      for (const depName of module.dependencies) {
        const depModule = this.modules.get(depName);
        if (depModule) {
          visit(depModule);
        }
      }

      visiting.delete(module.name);
      visited.add(module.name);
      sorted.push(module);
    };

    for (const module of modules) {
      if (!visited.has(module.name)) {
        visit(module);
      }
    }

    return sorted;
  }

  private getModulesByPriority(): PipelineModule[] {
    return Array.from(this.modules.values())
      .filter(module => module.config.enabled)
      .sort((a, b) => a.config.priority - b.config.priority);
  }
}

// Convenience functions for easy access
export const getPipeline = (): PipelineEngine => {
  return PipelineEngine.getInstance();
};

export const registerModule = (module: PipelineModule): void => {
  PipelineEngine.getInstance().registerModule(module);
};

export const processData = (input: any, sessionId: string, userId?: string): Promise<any> => {
  return PipelineEngine.getInstance().process(input, sessionId, userId);
};
