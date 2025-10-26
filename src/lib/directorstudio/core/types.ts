// MODULE: DirectorStudio Core Types
// VERSION: 1.0.0
// PURPOSE: Core type definitions for DirectorStudio ecosystem

export interface PipelineModule {
  readonly version: string;
  readonly name: string;
  readonly dependencies: string[];
  readonly config: ModuleConfig;
  
  initialize(): Promise<void>;
  process(input: any): Promise<any>;
  validate(): Promise<ValidationResult>;
  cleanup(): Promise<void>;
}

export interface ValidatableModule extends PipelineModule {
  validateStructure(): Promise<ValidationResult>;
  validateData(data: any): Promise<ValidationResult>;
  validateIntegration(): Promise<ValidationResult>;
}

export interface ModuleConfig {
  enabled: boolean;
  priority: number;
  timeout: number;
  retries: number;
  metadata: Record<string, any>;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  metrics: ValidationMetrics;
}

export interface ValidationError {
  code: string;
  message: string;
  severity: 'critical' | 'error' | 'warning';
  module: string;
  timestamp: Date;
}

export interface ValidationWarning {
  code: string;
  message: string;
  module: string;
  timestamp: Date;
}

export interface ValidationMetrics {
  executionTime: number;
  memoryUsage: number;
  cpuUsage: number;
  throughput: number;
}

export interface TelemetryEvent {
  id: string;
  type: string;
  module: string;
  data: Record<string, any>;
  timestamp: Date;
  userId?: string;
  sessionId?: string;
}

export interface ContinuityContext {
  sessionId: string;
  userId?: string;
  state: Record<string, any>;
  history: ContinuityEvent[];
  metadata: Record<string, any>;
}

export interface ContinuityEvent {
  id: string;
  type: string;
  timestamp: Date;
  data: any;
  module: string;
}

export interface DirectorStudioConfig {
  modules: Record<string, ModuleConfig>;
  telemetry: TelemetryConfig;
  continuity: ContinuityConfig;
  validation: ValidationConfig;
}

export interface TelemetryConfig {
  enabled: boolean;
  endpoint: string;
  batchSize: number;
  flushInterval: number;
  retentionDays: number;
}

export interface ContinuityConfig {
  enabled: boolean;
  storage: 'memory' | 'redis' | 'database';
  ttl: number;
  maxEvents: number;
}

export interface ValidationConfig {
  strictMode: boolean;
  autoValidate: boolean;
  timeout: number;
  retries: number;
}
