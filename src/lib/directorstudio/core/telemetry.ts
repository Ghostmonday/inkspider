// MODULE: DirectorStudio Telemetry
// VERSION: 1.0.0
// PURPOSE: Centralized telemetry and analytics system for DirectorStudio modules

import { TelemetryEvent, TelemetryConfig } from './types';

export class Telemetry {
  private static instance: Telemetry;
  private events: TelemetryEvent[] = [];
  private config: TelemetryConfig;
  private flushTimer?: NodeJS.Timeout;

  private constructor(config: TelemetryConfig) {
    this.config = config;
    this.startFlushTimer();
  }

  public static getInstance(config?: TelemetryConfig): Telemetry {
    if (!Telemetry.instance) {
      if (!config) {
        throw new Error('Telemetry must be initialized with configuration');
      }
      Telemetry.instance = new Telemetry(config);
    }
    return Telemetry.instance;
  }

  /**
   * Log a telemetry event
   */
  public logEvent(
    type: string,
    module: string,
    data: Record<string, any>,
    userId?: string,
    sessionId?: string
  ): void {
    if (!this.config.enabled) return;

    const event: TelemetryEvent = {
      id: this.generateEventId(),
      type,
      module,
      data,
      timestamp: new Date(),
      userId,
      sessionId
    };

    this.events.push(event);

    // Auto-flush if batch size reached
    if (this.events.length >= this.config.batchSize) {
      this.flush();
    }
  }

  /**
   * Log module execution metrics
   */
  public logMetrics(
    module: string,
    metrics: {
      executionTime: number;
      memoryUsage: number;
      cpuUsage: number;
      throughput: number;
    }
  ): void {
    this.logEvent('module_metrics', module, metrics);
  }

  /**
   * Log validation results
   */
  public logValidation(
    module: string,
    result: {
      isValid: boolean;
      errors: number;
      warnings: number;
      executionTime: number;
    }
  ): void {
    this.logEvent('validation_result', module, result);
  }

  /**
   * Log error events
   */
  public logError(
    module: string,
    error: Error,
    context?: Record<string, any>
  ): void {
    this.logEvent('error', module, {
      message: error.message,
      stack: error.stack,
      context
    });
  }

  /**
   * Get telemetry events for analysis
   */
  public getEvents(filter?: {
    module?: string;
    type?: string;
    startDate?: Date;
    endDate?: Date;
  }): TelemetryEvent[] {
    let filteredEvents = this.events;

    if (filter) {
      filteredEvents = this.events.filter(event => {
        if (filter.module && event.module !== filter.module) return false;
        if (filter.type && event.type !== filter.type) return false;
        if (filter.startDate && event.timestamp < filter.startDate) return false;
        if (filter.endDate && event.timestamp > filter.endDate) return false;
        return true;
      });
    }

    return filteredEvents;
  }

  /**
   * Flush events to storage/endpoint
   */
  public async flush(): Promise<void> {
    if (this.events.length === 0) return;

    const eventsToFlush = [...this.events];
    this.events = [];

    try {
      // In a real implementation, this would send to your telemetry endpoint
      console.log(`[Telemetry] Flushing ${eventsToFlush.length} events`);
      
      // Simulate API call
      await this.sendToEndpoint(eventsToFlush);
    } catch (error) {
      console.error('[Telemetry] Failed to flush events:', error);
      // Re-add events to queue for retry
      this.events.unshift(...eventsToFlush);
    }
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<TelemetryConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.startFlushTimer();
  }

  /**
   * Get current configuration
   */
  public getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startFlushTimer(): void {
    if (this.config.enabled && this.config.flushInterval > 0) {
      this.flushTimer = setInterval(() => {
        this.flush();
      }, this.config.flushInterval);
    }
  }

  private async sendToEndpoint(events: TelemetryEvent[]): Promise<void> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // In production, this would make an actual HTTP request
    console.log(`[Telemetry] Sent ${events.length} events to endpoint`);
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    this.flush();
  }
}

// Convenience function for easy access
export const logEvent = (
  type: string,
  module: string,
  data: Record<string, any>,
  userId?: string,
  sessionId?: string
) => {
  Telemetry.getInstance().logEvent(type, module, data, userId, sessionId);
};

export const logMetrics = (
  module: string,
  metrics: {
    executionTime: number;
    memoryUsage: number;
    cpuUsage: number;
    throughput: number;
  }
) => {
  Telemetry.getInstance().logMetrics(module, metrics);
};

export const logError = (
  module: string,
  error: Error,
  context?: Record<string, any>
) => {
  Telemetry.getInstance().logError(module, error, context);
};
