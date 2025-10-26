// Monitoring and error tracking utilities for SpiderInk.art
// This module provides comprehensive monitoring, error tracking, and analytics

interface ErrorEvent {
  id: string
  message: string
  stack?: string
  url: string
  userAgent: string
  userId?: string
  timestamp: number
  severity: 'low' | 'medium' | 'high' | 'critical'
  context?: Record<string, any>
}

interface PerformanceEvent {
  id: string
  name: string
  duration: number
  startTime: number
  endTime: number
  url: string
  userId?: string
  metadata?: Record<string, any>
}

interface UserEvent {
  id: string
  event: string
  userId?: string
  sessionId: string
  timestamp: number
  properties?: Record<string, any>
  url: string
}

interface MonitoringConfig {
  enableErrorTracking: boolean
  enablePerformanceTracking: boolean
  enableUserAnalytics: boolean
  enableConsoleLogging: boolean
  errorReportingEndpoint?: string
  performanceReportingEndpoint?: string
  analyticsEndpoint?: string
  sampleRate: number // 0-1, percentage of events to track
}

class MonitoringService {
  private config: MonitoringConfig
  private errors: ErrorEvent[] = []
  private performanceEvents: PerformanceEvent[] = []
  private userEvents: UserEvent[] = []
  private sessionId: string
  private userId?: string

  constructor(config: Partial<MonitoringConfig> = {}) {
    this.config = {
      enableErrorTracking: true,
      enablePerformanceTracking: true,
      enableUserAnalytics: true,
      enableConsoleLogging: true,
      sampleRate: 1.0,
      ...config
    }

    this.sessionId = this.generateSessionId()
    this.initializeMonitoring()
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private initializeMonitoring(): void {
    if (typeof window === 'undefined') return

    // Initialize error tracking
    if (this.config.enableErrorTracking) {
      this.setupErrorTracking()
    }

    // Initialize performance tracking
    if (this.config.enablePerformanceTracking) {
      this.setupPerformanceTracking()
    }

    // Initialize user analytics
    if (this.config.enableUserAnalytics) {
      this.setupUserAnalytics()
    }
  }

  private setupErrorTracking(): void {
    // Global error handler
    window.addEventListener('error', (event) => {
      this.trackError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        line: event.lineno,
        column: event.colno
      })
    })

    // Unhandled promise rejection handler
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        url: window.location.href
      })
    })
  }

  private setupPerformanceTracking(): void {
    // Track page load performance
    window.addEventListener('load', () => {
      setTimeout(() => {
        const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming
        if (navigation) {
          this.trackPerformance('page_load', {
            domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
            loadComplete: navigation.loadEventEnd - navigation.loadEventStart,
            totalTime: navigation.loadEventEnd - navigation.fetchStart,
            dnsLookup: navigation.domainLookupEnd - navigation.domainLookupStart,
            tcpConnect: navigation.connectEnd - navigation.connectStart,
            request: navigation.responseEnd - navigation.requestStart,
            response: navigation.responseEnd - navigation.responseStart
          })
        }
      }, 0)
    })

    // Track resource loading performance
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (entry.entryType === 'resource') {
          this.trackPerformance(`resource_${entry.name.split('.').pop()}`, {
            duration: entry.duration,
            size: (entry as any).transferSize || 0,
            url: entry.name
          })
        }
      })
    })

    observer.observe({ entryTypes: ['resource'] })
  }

  private setupUserAnalytics(): void {
    // Track page views
    this.trackUserEvent('page_view', {
      url: window.location.href,
      referrer: document.referrer,
      title: document.title
    })

    // Track clicks on important elements
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.trackUserEvent('click', {
          element: target.tagName,
          text: target.textContent?.trim(),
          href: (target as HTMLAnchorElement).href,
          className: target.className
        })
      }
    })

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement
      this.trackUserEvent('form_submit', {
        formId: form.id,
        formAction: form.action,
        formMethod: form.method
      })
    })
  }

  /**
   * Track an error event
   */
  trackError(error: {
    message: string
    stack?: string
    url?: string
    line?: number
    column?: number
    context?: Record<string, any>
    severity?: 'low' | 'medium' | 'high' | 'critical'
  }): void {
    if (!this.shouldSample()) return

    const errorEvent: ErrorEvent = {
      id: this.generateId(),
      message: error.message,
      stack: error.stack,
      url: error.url || window.location.href,
      userAgent: navigator.userAgent,
      userId: this.userId,
      timestamp: Date.now(),
      severity: error.severity || 'medium',
      context: error.context
    }

    this.errors.push(errorEvent)

    if (this.config.enableConsoleLogging) {
      console.error('Error tracked:', errorEvent)
    }

    // Send to external service if configured
    if (this.config.errorReportingEndpoint) {
      this.sendToEndpoint(this.config.errorReportingEndpoint, errorEvent)
    }
  }

  /**
   * Track a performance event
   */
  trackPerformance(name: string, metadata?: Record<string, any>): void {
    if (!this.shouldSample()) return

    const performanceEvent: PerformanceEvent = {
      id: this.generateId(),
      name,
      duration: metadata?.duration || 0,
      startTime: metadata?.startTime || Date.now(),
      endTime: metadata?.endTime || Date.now(),
      url: window.location.href,
      userId: this.userId,
      metadata
    }

    this.performanceEvents.push(performanceEvent)

    if (this.config.enableConsoleLogging) {
      console.log('Performance tracked:', performanceEvent)
    }

    // Send to external service if configured
    if (this.config.performanceReportingEndpoint) {
      this.sendToEndpoint(this.config.performanceReportingEndpoint, performanceEvent)
    }
  }

  /**
   * Track a user event
   */
  trackUserEvent(event: string, properties?: Record<string, any>): void {
    if (!this.shouldSample()) return

    const userEvent: UserEvent = {
      id: this.generateId(),
      event,
      userId: this.userId,
      sessionId: this.sessionId,
      timestamp: Date.now(),
      properties,
      url: window.location.href
    }

    this.userEvents.push(userEvent)

    if (this.config.enableConsoleLogging) {
      console.log('User event tracked:', userEvent)
    }

    // Send to external service if configured
    if (this.config.analyticsEndpoint) {
      this.sendToEndpoint(this.config.analyticsEndpoint, userEvent)
    }
  }

  /**
   * Set the current user ID for tracking
   */
  setUserId(userId: string): void {
    this.userId = userId
    this.trackUserEvent('user_identified', { userId })
  }

  /**
   * Clear user data
   */
  clearUser(): void {
    this.userId = undefined
    this.trackUserEvent('user_logout')
  }

  /**
   * Get monitoring statistics
   */
  getStats(): {
    errors: number
    performanceEvents: number
    userEvents: number
    errorRate: number
    averagePerformance: number
    topErrors: ErrorEvent[]
    slowestOperations: PerformanceEvent[]
  } {
    const now = Date.now()
    const last24Hours = now - (24 * 60 * 60 * 1000)

    const recentErrors = this.errors.filter(e => e.timestamp > last24Hours)
    const recentPerformance = this.performanceEvents.filter(p => p.timestamp > last24Hours)

    const topErrors = [...recentErrors]
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 }
        return severityOrder[b.severity] - severityOrder[a.severity]
      })
      .slice(0, 10)

    const slowestOperations = [...recentPerformance]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 10)

    const averagePerformance = recentPerformance.length > 0
      ? recentPerformance.reduce((sum, p) => sum + p.duration, 0) / recentPerformance.length
      : 0

    return {
      errors: recentErrors.length,
      performanceEvents: recentPerformance.length,
      userEvents: this.userEvents.filter(e => e.timestamp > last24Hours).length,
      errorRate: recentErrors.length / Math.max(recentPerformance.length, 1),
      averagePerformance,
      topErrors,
      slowestOperations
    }
  }

  /**
   * Export monitoring data
   */
  exportData(): {
    errors: ErrorEvent[]
    performanceEvents: PerformanceEvent[]
    userEvents: UserEvent[]
    config: MonitoringConfig
  } {
    return {
      errors: [...this.errors],
      performanceEvents: [...this.performanceEvents],
      userEvents: [...this.userEvents],
      config: { ...this.config }
    }
  }

  private shouldSample(): boolean {
    return Math.random() < this.config.sampleRate
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private async sendToEndpoint(endpoint: string, data: any): Promise<void> {
    try {
      await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
    } catch (error) {
      console.warn('Failed to send monitoring data:', error)
    }
  }
}

// Global monitoring service instance
export const monitoring = new MonitoringService({
  enableErrorTracking: true,
  enablePerformanceTracking: true,
  enableUserAnalytics: true,
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  sampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0
})

/**
 * React hook for monitoring component performance
 */
export function usePerformanceMonitoring(componentName: string) {
  const startTime = Date.now()

  React.useEffect(() => {
    const endTime = Date.now()
    monitoring.trackPerformance(`component_${componentName}`, {
      duration: endTime - startTime,
      component: componentName
    })
  }, [componentName, startTime])

  return {
    trackEvent: (event: string, properties?: Record<string, any>) => {
      monitoring.trackUserEvent(event, {
        component: componentName,
        ...properties
      })
    }
  }
}

/**
 * Higher-order component for monitoring component errors
 */
export function withErrorMonitoring<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
) {
  return function MonitoredComponent(props: P) {
    return (
      <ErrorBoundary
        onError={(error, errorInfo) => {
          monitoring.trackError({
            message: error.message,
            stack: error.stack,
            context: {
              component: componentName,
              props: JSON.stringify(props),
              errorInfo: errorInfo.componentStack
            },
            severity: 'high'
          })
        }}
      >
        <Component {...props} />
      </ErrorBoundary>
    )
  }
}

/**
 * Error boundary component for React
 */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; onError: (error: Error, errorInfo: React.ErrorInfo) => void },
  { hasError: boolean }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    this.props.onError(error, errorInfo)
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-lg font-semibold text-red-800 mb-2">Something went wrong</h2>
          <p className="text-red-600 mb-4">
            We're sorry, but something unexpected happened. Please try refreshing the page.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * API monitoring utilities
 */
export const apiMonitoring = {
  /**
   * Monitor API call performance
   */
  async monitorApiCall<T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await apiCall()
      const duration = Date.now() - startTime
      
      monitoring.trackPerformance(`api_${method.toLowerCase()}_${endpoint}`, {
        duration,
        endpoint,
        method,
        success: true
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      monitoring.trackError({
        message: `API Error: ${error}`,
        context: {
          endpoint,
          method,
          duration,
          error: error instanceof Error ? error.message : String(error)
        },
        severity: 'high'
      })
      
      monitoring.trackPerformance(`api_${method.toLowerCase()}_${endpoint}`, {
        duration,
        endpoint,
        method,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      throw error
    }
  }
}

/**
 * Database monitoring utilities
 */
export const dbMonitoring = {
  /**
   * Monitor database query performance
   */
  async monitorQuery<T>(
    queryFn: () => Promise<T>,
    queryName: string,
    tableName?: string
  ): Promise<T> {
    const startTime = Date.now()
    
    try {
      const result = await queryFn()
      const duration = Date.now() - startTime
      
      monitoring.trackPerformance(`db_query_${queryName}`, {
        duration,
        queryName,
        tableName,
        success: true
      })
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      
      monitoring.trackError({
        message: `Database Error: ${error}`,
        context: {
          queryName,
          tableName,
          duration,
          error: error instanceof Error ? error.message : String(error)
        },
        severity: 'high'
      })
      
      monitoring.trackPerformance(`db_query_${queryName}`, {
        duration,
        queryName,
        tableName,
        success: false,
        error: error instanceof Error ? error.message : String(error)
      })
      
      throw error
    }
  }
}

export default {
  monitoring,
  usePerformanceMonitoring,
  withErrorMonitoring,
  ErrorBoundary,
  apiMonitoring,
  dbMonitoring
}
