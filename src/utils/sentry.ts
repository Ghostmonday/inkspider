// Sentry Configuration for SpiderInk.art
// This file provides comprehensive error tracking and performance monitoring

import * as Sentry from '@sentry/nextjs'

// Sentry configuration
const SENTRY_DSN = process.env.SENTRY_DSN
const SENTRY_ORG = process.env.SENTRY_ORG || 'spiderink-art'
const SENTRY_PROJECT = process.env.SENTRY_PROJECT || 'spiderink-art'
const ENVIRONMENT = process.env.NODE_ENV || 'development'

// Initialize Sentry
if (SENTRY_DSN) {
  Sentry.init({
    dsn: SENTRY_DSN,
    environment: ENVIRONMENT,
    
    // Performance monitoring
    tracesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    profilesSampleRate: ENVIRONMENT === 'production' ? 0.1 : 1.0,
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out non-critical errors in production
      if (ENVIRONMENT === 'production') {
        // Don't send client-side errors for 4xx status codes
        if (event.exception) {
          const error = hint.originalException
          if (error instanceof Error && error.message.includes('404')) {
            return null
          }
        }
        
        // Don't send network errors
        if (event.exception) {
          const error = hint.originalException
          if (error instanceof Error && (
            error.message.includes('NetworkError') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('Load failed')
          )) {
            return null
          }
        }
      }
      
      return event
    },
    
    // Custom tags
    initialScope: {
      tags: {
        component: 'spiderink-art',
        version: process.env.npm_package_version || '1.0.0'
      }
    },
    
    // Integration configuration
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app: undefined }),
      new Sentry.Integrations.Postgres({ usePgNative: false }),
    ],
    
    // Release tracking
    release: process.env.VERCEL_GIT_COMMIT_SHA || 'unknown',
    
    // Debug mode
    debug: ENVIRONMENT === 'development',
    
    // Server name
    serverName: process.env.VERCEL_URL || 'localhost',
    
    // Custom fingerprinting
    beforeSendTransaction(event) {
      // Group similar transactions
      if (event.transaction) {
        // Normalize API routes
        event.transaction = event.transaction.replace(/\/[0-9a-f-]{36}/g, '/:id')
        event.transaction = event.transaction.replace(/\/[0-9]+/g, '/:id')
      }
      
      return event
    }
  })
}

// Custom error tracking utilities
export const errorTracking = {
  // Track custom errors
  captureError: (error: Error, context?: Record<string, any>) => {
    if (SENTRY_DSN) {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value)
          })
        }
        Sentry.captureException(error)
      })
    }
  },

  // Track custom messages
  captureMessage: (message: string, level: Sentry.SeverityLevel = 'info', context?: Record<string, any>) => {
    if (SENTRY_DSN) {
      Sentry.withScope((scope) => {
        if (context) {
          Object.entries(context).forEach(([key, value]) => {
            scope.setContext(key, value)
          })
        }
        Sentry.captureMessage(message, level)
      })
    }
  },

  // Set user context
  setUser: (user: { id: string; email?: string; username?: string }) => {
    if (SENTRY_DSN) {
      Sentry.setUser(user)
    }
  },

  // Clear user context
  clearUser: () => {
    if (SENTRY_DSN) {
      Sentry.setUser(null)
    }
  },

  // Add breadcrumb
  addBreadcrumb: (breadcrumb: Sentry.Breadcrumb) => {
    if (SENTRY_DSN) {
      Sentry.addBreadcrumb(breadcrumb)
    }
  },

  // Set custom tags
  setTag: (key: string, value: string) => {
    if (SENTRY_DSN) {
      Sentry.setTag(key, value)
    }
  },

  // Set custom context
  setContext: (key: string, context: Record<string, any>) => {
    if (SENTRY_DSN) {
      Sentry.setContext(key, context)
    }
  },

  // Start transaction
  startTransaction: (name: string, op: string = 'custom') => {
    if (SENTRY_DSN) {
      return Sentry.startTransaction({ name, op })
    }
    return null
  },

  // Capture performance metrics
  capturePerformance: (name: string, duration: number, context?: Record<string, any>) => {
    if (SENTRY_DSN) {
      const transaction = Sentry.startTransaction({ name, op: 'performance' })
      
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          transaction.setContext(key, value)
        })
      }
      
      transaction.setData('duration', duration)
      transaction.finish()
    }
  }
}

// API error tracking wrapper
export function withErrorTracking<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  context?: Record<string, any>
) {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args)
    } catch (error) {
      errorTracking.captureError(error as Error, {
        function: fn.name,
        arguments: args,
        ...context
      })
      throw error
    }
  }
}

// React error boundary component
export class SentryErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ComponentType<{ error: Error }> },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    errorTracking.captureError(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true
    })
  }

  render() {
    if (this.state.hasError) {
      const FallbackComponent = this.props.fallback || DefaultErrorFallback
      return <FallbackComponent error={this.state.error!} />
    }

    return this.props.children
  }
}

// Default error fallback component
function DefaultErrorFallback({ error }: { error: Error }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md mx-auto text-center">
        <div className="text-red-500 text-6xl mb-4">⚠️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h1>
        <p className="text-gray-600 mb-6">
          We're sorry, but something unexpected happened. Our team has been notified.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          Try Again
        </button>
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-6 text-left">
            <summary className="cursor-pointer text-sm text-gray-500">Error Details</summary>
            <pre className="mt-2 text-xs text-gray-400 bg-gray-100 p-4 rounded overflow-auto">
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  )
}

// Performance monitoring utilities
export const performanceTracking = {
  // Track API call performance
  trackApiCall: async <T>(
    apiCall: () => Promise<T>,
    endpoint: string,
    method: string = 'GET'
  ): Promise<T> => {
    const transaction = errorTracking.startTransaction(`api.${method.toLowerCase()}.${endpoint}`, 'http.client')
    
    try {
      const result = await apiCall()
      transaction?.setStatus('ok')
      return result
    } catch (error) {
      transaction?.setStatus('internal_error')
      throw error
    } finally {
      transaction?.finish()
    }
  },

  // Track database query performance
  trackDatabaseQuery: async <T>(
    query: () => Promise<T>,
    tableName: string,
    operation: string = 'select'
  ): Promise<T> => {
    const transaction = errorTracking.startTransaction(`db.${operation}.${tableName}`, 'db')
    
    try {
      const result = await query()
      transaction?.setStatus('ok')
      return result
    } catch (error) {
      transaction?.setStatus('internal_error')
      throw error
    } finally {
      transaction?.finish()
    }
  },

  // Track file upload performance
  trackFileUpload: async <T>(
    upload: () => Promise<T>,
    fileName: string,
    fileSize: number
  ): Promise<T> => {
    const transaction = errorTracking.startTransaction('file.upload', 'file')
    transaction?.setData('file_name', fileName)
    transaction?.setData('file_size', fileSize)
    
    try {
      const result = await upload()
      transaction?.setStatus('ok')
      return result
    } catch (error) {
      transaction?.setStatus('internal_error')
      throw error
    } finally {
      transaction?.finish()
    }
  }
}

// Breadcrumb utilities
export const breadcrumbs = {
  // Navigation breadcrumb
  navigation: (from: string, to: string) => {
    errorTracking.addBreadcrumb({
      category: 'navigation',
      message: `Navigated from ${from} to ${to}`,
      level: 'info'
    })
  },

  // User action breadcrumb
  userAction: (action: string, context?: Record<string, any>) => {
    errorTracking.addBreadcrumb({
      category: 'user',
      message: action,
      level: 'info',
      data: context
    })
  },

  // API call breadcrumb
  apiCall: (method: string, url: string, statusCode?: number) => {
    errorTracking.addBreadcrumb({
      category: 'http',
      message: `${method} ${url}`,
      level: statusCode && statusCode >= 400 ? 'error' : 'info',
      data: { status_code: statusCode }
    })
  },

  // Database operation breadcrumb
  databaseOperation: (operation: string, table: string, duration?: number) => {
    errorTracking.addBreadcrumb({
      category: 'db',
      message: `${operation} on ${table}`,
      level: 'info',
      data: { duration }
    })
  }
}

// Custom Sentry configuration for different environments
export const sentryConfig = {
  development: {
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    debug: true
  },
  staging: {
    tracesSampleRate: 0.5,
    profilesSampleRate: 0.5,
    debug: false
  },
  production: {
    tracesSampleRate: 0.1,
    profilesSampleRate: 0.1,
    debug: false
  }
}

export default {
  errorTracking,
  performanceTracking,
  breadcrumbs,
  withErrorTracking,
  SentryErrorBoundary,
  sentryConfig
}
