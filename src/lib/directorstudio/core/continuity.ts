// MODULE: DirectorStudio Continuity Engine
// VERSION: 1.0.0
// PURPOSE: State management and continuity system for DirectorStudio modules

import { ContinuityContext, ContinuityEvent, ContinuityConfig } from './types';
import { logEvent } from './telemetry';

export class ContinuityEngine {
  private static instance: ContinuityEngine;
  private contexts: Map<string, ContinuityContext> = new Map();
  private config: ContinuityConfig;
  private cleanupTimer?: NodeJS.Timeout;

  private constructor(config: ContinuityConfig) {
    this.config = config;
    this.startCleanupTimer();
  }

  public static getInstance(config?: ContinuityConfig): ContinuityEngine {
    if (!ContinuityEngine.instance) {
      if (!config) {
        throw new Error('ContinuityEngine must be initialized with configuration');
      }
      ContinuityEngine.instance = new ContinuityEngine(config);
    }
    return ContinuityEngine.instance;
  }

  /**
   * Create or get a continuity context
   */
  public getContext(sessionId: string, userId?: string): ContinuityContext {
    if (!this.contexts.has(sessionId)) {
      const context: ContinuityContext = {
        sessionId,
        userId,
        state: {},
        history: [],
        metadata: {
          createdAt: new Date(),
          lastAccessed: new Date()
        }
      };
      this.contexts.set(sessionId, context);
      
      logEvent('continuity_context_created', 'ContinuityEngine', {
        sessionId,
        userId
      });
    } else {
      // Update last accessed time
      const context = this.contexts.get(sessionId)!;
      context.metadata.lastAccessed = new Date();
    }

    return this.contexts.get(sessionId)!;
  }

  /**
   * Update context state
   */
  public updateState(
    sessionId: string,
    updates: Record<string, any>,
    module: string
  ): void {
    const context = this.getContext(sessionId);
    
    // Merge updates into state
    context.state = { ...context.state, ...updates };
    
    // Add to history
    this.addEvent(sessionId, 'state_update', {
      module,
      updates,
      timestamp: new Date()
    }, module);

    logEvent('continuity_state_updated', 'ContinuityEngine', {
      sessionId,
      module,
      updateCount: Object.keys(updates).length
    });
  }

  /**
   * Get context state
   */
  public getState(sessionId: string, key?: string): any {
    const context = this.getContext(sessionId);
    
    if (key) {
      return context.state[key];
    }
    
    return { ...context.state };
  }

  /**
   * Add event to context history
   */
  public addEvent(
    sessionId: string,
    type: string,
    data: any,
    module: string
  ): void {
    const context = this.getContext(sessionId);
    
    const event: ContinuityEvent = {
      id: this.generateEventId(),
      type,
      timestamp: new Date(),
      data,
      module
    };

    context.history.push(event);

    // Limit history size
    if (context.history.length > this.config.maxEvents) {
      context.history = context.history.slice(-this.config.maxEvents);
    }

    logEvent('continuity_event_added', 'ContinuityEngine', {
      sessionId,
      eventType: type,
      module,
      historyLength: context.history.length
    });
  }

  /**
   * Get context history
   */
  public getHistory(
    sessionId: string,
    filter?: {
      type?: string;
      module?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): ContinuityEvent[] {
    const context = this.getContext(sessionId);
    let filteredHistory = context.history;

    if (filter) {
      filteredHistory = context.history.filter(event => {
        if (filter.type && event.type !== filter.type) return false;
        if (filter.module && event.module !== filter.module) return false;
        if (filter.startDate && event.timestamp < filter.startDate) return false;
        if (filter.endDate && event.timestamp > filter.endDate) return false;
        return true;
      });
    }

    return filteredHistory;
  }

  /**
   * Clear context state
   */
  public clearState(sessionId: string, module?: string): void {
    const context = this.getContext(sessionId);
    
    if (module) {
      // Clear only module-specific state
      Object.keys(context.state).forEach(key => {
        if (key.startsWith(`${module}:`)) {
          delete context.state[key];
        }
      });
    } else {
      // Clear all state
      context.state = {};
    }

    this.addEvent(sessionId, 'state_cleared', { module }, module || 'ContinuityEngine');

    logEvent('continuity_state_cleared', 'ContinuityEngine', {
      sessionId,
      module
    });
  }

  /**
   * Destroy context
   */
  public destroyContext(sessionId: string): void {
    if (this.contexts.has(sessionId)) {
      this.contexts.delete(sessionId);
      
      logEvent('continuity_context_destroyed', 'ContinuityEngine', {
        sessionId
      });
    }
  }

  /**
   * Get all active contexts
   */
  public getActiveContexts(): ContinuityContext[] {
    return Array.from(this.contexts.values());
  }

  /**
   * Update configuration
   */
  public updateConfig(config: Partial<ContinuityConfig>): void {
    this.config = { ...this.config, ...config };
    
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.startCleanupTimer();
  }

  /**
   * Get current configuration
   */
  public getConfig(): ContinuityConfig {
    return { ...this.config };
  }

  private generateEventId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private startCleanupTimer(): void {
    if (this.config.enabled && this.config.ttl > 0) {
      this.cleanupTimer = setInterval(() => {
        this.cleanupExpiredContexts();
      }, 60000); // Check every minute
    }
  }

  private cleanupExpiredContexts(): void {
    const now = new Date();
    const expiredSessions: string[] = [];

    this.contexts.forEach((context, sessionId) => {
      const lastAccessed = context.metadata.lastAccessed as Date;
      const age = now.getTime() - lastAccessed.getTime();
      
      if (age > this.config.ttl) {
        expiredSessions.push(sessionId);
      }
    });

    expiredSessions.forEach(sessionId => {
      this.destroyContext(sessionId);
    });

    if (expiredSessions.length > 0) {
      logEvent('continuity_cleanup', 'ContinuityEngine', {
        expiredSessions: expiredSessions.length
      });
    }
  }

  /**
   * Cleanup resources
   */
  public destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.contexts.clear();
  }
}

// Convenience functions for easy access
export const getContext = (sessionId: string, userId?: string): ContinuityContext => {
  return ContinuityEngine.getInstance().getContext(sessionId, userId);
};

export const updateState = (
  sessionId: string,
  updates: Record<string, any>,
  module: string
): void => {
  ContinuityEngine.getInstance().updateState(sessionId, updates, module);
};

export const getState = (sessionId: string, key?: string): any => {
  return ContinuityEngine.getInstance().getState(sessionId, key);
};

export const addEvent = (
  sessionId: string,
  type: string,
  data: any,
  module: string
): void => {
  ContinuityEngine.getInstance().addEvent(sessionId, type, data, module);
};
