// MODULE: DirectorStudio Validator
// VERSION: 1.0.0
// PURPOSE: Comprehensive validation system for DirectorStudio modules

import { 
  PipelineModule, 
  ValidatableModule, 
  ValidationResult, 
  ValidationError, 
  ValidationWarning,
  ValidationMetrics,
  ValidationConfig
} from './types';
import { logEvent, logValidation } from './telemetry';

export class DirectorStudioValidator {
  private static instance: DirectorStudioValidator;
  private config: ValidationConfig;
  private validationCache: Map<string, ValidationResult> = new Map();

  private constructor(config: ValidationConfig) {
    this.config = config;
  }

  public static getInstance(config?: ValidationConfig): DirectorStudioValidator {
    if (!DirectorStudioValidator.instance) {
      if (!config) {
        throw new Error('DirectorStudioValidator must be initialized with configuration');
      }
      DirectorStudioValidator.instance = new DirectorStudioValidator(config);
    }
    return DirectorStudioValidator.instance;
  }

  /**
   * Validate a pipeline module
   */
  public async validateModule(module: PipelineModule): Promise<ValidationResult> {
    const startTime = Date.now();
    const moduleName = module.name;
    
    logEvent('validation_started', 'DirectorStudioValidator', {
      module: moduleName,
      version: module.version
    });

    try {
      const result = await this.performModuleValidation(module);
      
      const executionTime = Date.now() - startTime;
      result.metrics.executionTime = executionTime;
      
      // Cache result if validation passed
      if (result.isValid) {
        this.validationCache.set(moduleName, result);
      }

      logValidation(moduleName, {
        isValid: result.isValid,
        errors: result.errors.length,
        warnings: result.warnings.length,
        executionTime
      });

      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const errorResult: ValidationResult = {
        isValid: false,
        errors: [{
          code: 'VALIDATION_ERROR',
          message: error instanceof Error ? error.message : 'Unknown validation error',
          severity: 'critical',
          module: moduleName,
          timestamp: new Date()
        }],
        warnings: [],
        metrics: {
          executionTime,
          memoryUsage: 0,
          cpuUsage: 0,
          throughput: 0
        }
      };

      logValidation(moduleName, {
        isValid: false,
        errors: 1,
        warnings: 0,
        executionTime
      });

      return errorResult;
    }
  }

  /**
   * Validate module structure
   */
  public async validateStructure(module: PipelineModule): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check required properties
    if (!module.name) {
      errors.push({
        code: 'MISSING_NAME',
        message: 'Module must have a name property',
        severity: 'critical',
        module: 'unknown',
        timestamp: new Date()
      });
    }

    if (!module.version) {
      errors.push({
        code: 'MISSING_VERSION',
        message: 'Module must have a version property',
        severity: 'critical',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    if (!module.initialize || typeof module.initialize !== 'function') {
      errors.push({
        code: 'MISSING_INITIALIZE',
        message: 'Module must implement initialize() method',
        severity: 'critical',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    if (!module.process || typeof module.process !== 'function') {
      errors.push({
        code: 'MISSING_PROCESS',
        message: 'Module must implement process() method',
        severity: 'critical',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    if (!module.validate || typeof module.validate !== 'function') {
      errors.push({
        code: 'MISSING_VALIDATE',
        message: 'Module must implement validate() method',
        severity: 'critical',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    if (!module.cleanup || typeof module.cleanup !== 'function') {
      errors.push({
        code: 'MISSING_CLEANUP',
        message: 'Module must implement cleanup() method',
        severity: 'error',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    // Check version format
    if (module.version && !this.isValidVersion(module.version)) {
      warnings.push({
        code: 'INVALID_VERSION_FORMAT',
        message: 'Version should follow semantic versioning (e.g., 1.0.0)',
        module: module.name || 'unknown',
        timestamp: new Date()
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        executionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0
      }
    };
  }

  /**
   * Validate module data
   */
  public async validateData(module: PipelineModule, data: any): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Basic data validation
    if (data === null || data === undefined) {
      errors.push({
        code: 'NULL_DATA',
        message: 'Data cannot be null or undefined',
        severity: 'error',
        module: module.name,
        timestamp: new Date()
      });
    }

    // Type-specific validation based on module type
    if (module.name.includes('Video') && data) {
      if (typeof data === 'object' && data.file_url) {
        if (!this.isValidUrl(data.file_url)) {
          errors.push({
            code: 'INVALID_URL',
            message: 'Invalid file URL format',
            severity: 'error',
            module: module.name,
            timestamp: new Date()
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        executionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0
      }
    };
  }

  /**
   * Validate module integration
   */
  public async validateIntegration(module: PipelineModule): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check dependencies
    if (module.dependencies && Array.isArray(module.dependencies)) {
      for (const dep of module.dependencies) {
        if (typeof dep !== 'string') {
          errors.push({
            code: 'INVALID_DEPENDENCY',
            message: `Dependency must be a string: ${dep}`,
            severity: 'error',
            module: module.name,
            timestamp: new Date()
          });
        }
      }
    }

    // Check configuration
    if (module.config) {
      if (typeof module.config.enabled !== 'boolean') {
        warnings.push({
          code: 'MISSING_ENABLED_CONFIG',
          message: 'Config should have enabled property',
          module: module.name,
          timestamp: new Date()
        });
      }

      if (typeof module.config.priority !== 'number') {
        warnings.push({
          code: 'MISSING_PRIORITY_CONFIG',
          message: 'Config should have priority property',
          module: module.name,
          timestamp: new Date()
        });
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        executionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0
      }
    };
  }

  /**
   * Get cached validation result
   */
  public getCachedResult(moduleName: string): ValidationResult | undefined {
    return this.validationCache.get(moduleName);
  }

  /**
   * Clear validation cache
   */
  public clearCache(): void {
    this.validationCache.clear();
    logEvent('validation_cache_cleared', 'DirectorStudioValidator', {});
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ValidationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Get current configuration
   */
  public getConfig(): ValidationConfig {
    return { ...this.config };
  }

  private async performModuleValidation(module: PipelineModule): Promise<ValidationResult> {
    const results: ValidationResult[] = [];

    // Structure validation
    const structureResult = await this.validateStructure(module);
    results.push(structureResult);

    // Integration validation
    const integrationResult = await this.validateIntegration(module);
    results.push(integrationResult);

    // Module-specific validation
    const moduleResult = await module.validate();
    results.push(moduleResult);

    // Combine results
    const allErrors = results.flatMap(r => r.errors);
    const allWarnings = results.flatMap(r => r.warnings);
    const totalExecutionTime = results.reduce((sum, r) => sum + r.metrics.executionTime, 0);

    return {
      isValid: allErrors.length === 0,
      errors: allErrors,
      warnings: allWarnings,
      metrics: {
        executionTime: totalExecutionTime,
        memoryUsage: 0, // Would be calculated in real implementation
        cpuUsage: 0,    // Would be calculated in real implementation
        throughput: 0   // Would be calculated in real implementation
      }
    };
  }

  private isValidVersion(version: string): boolean {
    const versionRegex = /^\d+\.\d+\.\d+$/;
    return versionRegex.test(version);
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }
}

// Convenience functions for easy access
export const validateModule = (module: PipelineModule): Promise<ValidationResult> => {
  return DirectorStudioValidator.getInstance().validateModule(module);
};

export const validateStructure = (module: PipelineModule): Promise<ValidationResult> => {
  return DirectorStudioValidator.getInstance().validateStructure(module);
};

export const validateData = (module: PipelineModule, data: any): Promise<ValidationResult> => {
  return DirectorStudioValidator.getInstance().validateData(module, data);
};