// Health Check and Monitoring Endpoints for SpiderInk.art
// This file provides comprehensive health monitoring for production

import { NextApiRequest, NextApiResponse } from 'next'
import { createClient } from '@supabase/supabase-js'
import { performanceOptimizer } from '../../utils/performance'
import { monitoring } from '../../utils/monitoring'

// Health check configuration
const HEALTH_CHECK_CONFIG = {
  timeout: 5000,
  criticalServices: ['database', 'storage', 'auth'],
  warningThresholds: {
    responseTime: 1000,
    errorRate: 0.05,
    memoryUsage: 0.8,
    cpuUsage: 0.8
  }
}

// Create Supabase client for health checks
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ==============================================
// MAIN HEALTH CHECK ENDPOINT
// ==============================================

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const startTime = Date.now()
  
  try {
    // Run all health checks
    const checks = await Promise.allSettled([
      checkDatabase(),
      checkStorage(),
      checkAuth(),
      checkPerformance(),
      checkMonitoring(),
      checkEnvironment()
    ])

    const results = checks.map((check, index) => ({
      service: HEALTH_CHECK_CONFIG.criticalServices[index] || 'other',
      status: check.status === 'fulfilled' ? 'healthy' : 'unhealthy',
      details: check.status === 'fulfilled' ? check.value : check.reason,
      responseTime: Date.now() - startTime
    }))

    const overallStatus = results.every(r => r.status === 'healthy') ? 'healthy' : 'unhealthy'
    const criticalFailures = results.filter(r => 
      HEALTH_CHECK_CONFIG.criticalServices.includes(r.service) && r.status === 'unhealthy'
    )

    const response = {
      status: criticalFailures.length > 0 ? 'unhealthy' : overallStatus,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      checks: results,
      metrics: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        responseTime: Date.now() - startTime
      }
    }

    // Set appropriate HTTP status code
    const statusCode = criticalFailures.length > 0 ? 503 : 200
    res.status(statusCode).json(response)

    // Track health check in monitoring
    monitoring.trackPerformance('health_check', {
      duration: Date.now() - startTime,
      status: response.status,
      criticalFailures: criticalFailures.length
    })

  } catch (error) {
    console.error('Health check failed:', error)
    
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Health check system failure',
      details: error instanceof Error ? error.message : 'Unknown error'
    })

    monitoring.trackError({
      message: 'Health check system failure',
      context: { error: error instanceof Error ? error.message : 'Unknown error' },
      severity: 'high'
    })
  }
}

// ==============================================
// INDIVIDUAL HEALTH CHECKS
// ==============================================

async function checkDatabase() {
  const startTime = Date.now()
  
  try {
    // Test basic connectivity
    const { data, error } = await supabase
      .from('user_profiles')
      .select('count')
      .limit(1)

    if (error) throw error

    // Test write capability
    const testId = `health-check-${Date.now()}`
    const { error: insertError } = await supabase
      .from('user_profiles')
      .insert({
        id: testId,
        email: 'health-check@example.com'
      })

    if (insertError) throw insertError

    // Clean up test data
    await supabase
      .from('user_profiles')
      .delete()
      .eq('id', testId)

    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      message: 'Database connection and operations successful'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Database check failed'
    }
  }
}

async function checkStorage() {
  const startTime = Date.now()
  
  try {
    // Test storage bucket access
    const { data, error } = await supabase.storage
      .from('videos')
      .list('', { limit: 1 })

    if (error) throw error

    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      message: 'Storage buckets accessible'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Storage check failed'
    }
  }
}

async function checkAuth() {
  const startTime = Date.now()
  
  try {
    // Test auth service
    const { data, error } = await supabase.auth
      .getSession()

    if (error) throw error

    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      message: 'Authentication service accessible'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Auth check failed'
    }
  }
}

async function checkPerformance() {
  const startTime = Date.now()
  
  try {
    const stats = performanceOptimizer.getStats()
    
    const isHealthy = 
      stats.averageQueryTime < HEALTH_CHECK_CONFIG.warningThresholds.responseTime &&
      stats.cacheHitRate > 50

    return {
      status: isHealthy ? 'healthy' : 'warning',
      responseTime: Date.now() - startTime,
      message: 'Performance metrics within acceptable range',
      metrics: {
        averageQueryTime: stats.averageQueryTime,
        cacheHitRate: stats.cacheHitRate,
        totalQueries: stats.totalQueries
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Performance check failed'
    }
  }
}

async function checkMonitoring() {
  const startTime = Date.now()
  
  try {
    const stats = monitoring.getStats()
    
    const isHealthy = stats.errorRate < HEALTH_CHECK_CONFIG.warningThresholds.errorRate

    return {
      status: isHealthy ? 'healthy' : 'warning',
      responseTime: Date.now() - startTime,
      message: 'Monitoring system operational',
      metrics: {
        errors: stats.errors,
        performanceEvents: stats.performanceEvents,
        userEvents: stats.userEvents,
        errorRate: stats.errorRate
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Monitoring check failed'
    }
  }
}

async function checkEnvironment() {
  const startTime = Date.now()
  
  try {
    const requiredEnvVars = [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'APP_UPLOAD_SECRET'
    ]

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName])

    if (missingVars.length > 0) {
      throw new Error(`Missing required environment variables: ${missingVars.join(', ')}`)
    }

    return {
      status: 'healthy',
      responseTime: Date.now() - startTime,
      message: 'All required environment variables present',
      environment: process.env.NODE_ENV || 'development'
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'Environment check failed'
    }
  }
}

// ==============================================
// DETAILED HEALTH CHECK ENDPOINT
// ==============================================

export async function detailedHealthCheck(req: NextApiRequest, res: NextApiResponse) {
  try {
    const checks = {
      database: await checkDatabase(),
      storage: await checkStorage(),
      auth: await checkAuth(),
      performance: await checkPerformance(),
      monitoring: await checkMonitoring(),
      environment: await checkEnvironment(),
      system: await checkSystemResources(),
      external: await checkExternalServices()
    }

    const overallStatus = Object.values(checks).every(check => 
      check.status === 'healthy' || check.status === 'warning'
    ) ? 'healthy' : 'unhealthy'

    res.status(200).json({
      status: overallStatus,
      timestamp: new Date().toISOString(),
      checks,
      summary: {
        total: Object.keys(checks).length,
        healthy: Object.values(checks).filter(c => c.status === 'healthy').length,
        warning: Object.values(checks).filter(c => c.status === 'warning').length,
        unhealthy: Object.values(checks).filter(c => c.status === 'unhealthy').length
      }
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: 'Detailed health check failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// ==============================================
// ADDITIONAL HEALTH CHECKS
// ==============================================

async function checkSystemResources() {
  const startTime = Date.now()
  
  try {
    const memoryUsage = process.memoryUsage()
    const cpuUsage = process.cpuUsage()
    
    const memoryUsagePercent = memoryUsage.heapUsed / memoryUsage.heapTotal
    const isHealthy = memoryUsagePercent < HEALTH_CHECK_CONFIG.warningThresholds.memoryUsage

    return {
      status: isHealthy ? 'healthy' : 'warning',
      responseTime: Date.now() - startTime,
      message: 'System resources within acceptable limits',
      metrics: {
        memoryUsage: memoryUsagePercent,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rss: memoryUsage.rss
      }
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'System resources check failed'
    }
  }
}

async function checkExternalServices() {
  const startTime = Date.now()
  
  try {
    const externalServices = [
      { name: 'Sentry', url: process.env.SENTRY_DSN ? 'https://sentry.io' : null },
      { name: 'Analytics', url: process.env.ANALYTICS_ENDPOINT },
      { name: 'CDN', url: process.env.CDN_URL }
    ]

    const results = await Promise.allSettled(
      externalServices
        .filter(service => service.url)
        .map(async service => {
          const response = await fetch(service.url!, { 
            method: 'HEAD',
            timeout: 5000 
          })
          return {
            name: service.name,
            status: response.ok ? 'healthy' : 'unhealthy',
            statusCode: response.status
          }
        })
    )

    const serviceResults = results.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value
      } else {
        return {
          name: externalServices[index].name,
          status: 'unhealthy',
          error: result.reason.message
        }
      }
    })

    const healthyServices = serviceResults.filter(s => s.status === 'healthy').length
    const totalServices = serviceResults.length

    return {
      status: healthyServices === totalServices ? 'healthy' : 'warning',
      responseTime: Date.now() - startTime,
      message: `${healthyServices}/${totalServices} external services healthy`,
      services: serviceResults
    }
  } catch (error) {
    return {
      status: 'unhealthy',
      responseTime: Date.now() - startTime,
      error: error instanceof Error ? error.message : 'External services check failed'
    }
  }
}

// ==============================================
// METRICS ENDPOINT
// ==============================================

export async function metricsEndpoint(req: NextApiRequest, res: NextApiResponse) {
  try {
    const performanceStats = performanceOptimizer.getStats()
    const monitoringStats = monitoring.getStats()
    
    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      performance: {
        averageQueryTime: performanceStats.averageQueryTime,
        cacheHitRate: performanceStats.cacheHitRate,
        totalQueries: performanceStats.totalQueries,
        slowestQueries: performanceStats.slowestQueries.slice(0, 5)
      },
      monitoring: {
        errors: monitoringStats.errors,
        performanceEvents: monitoringStats.performanceEvents,
        userEvents: monitoringStats.userEvents,
        errorRate: monitoringStats.errorRate,
        topErrors: monitoringStats.topErrors.slice(0, 5)
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid
      }
    }

    res.status(200).json(metrics)
  } catch (error) {
    res.status(500).json({
      error: 'Failed to retrieve metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// ==============================================
// READINESS PROBE
// ==============================================

export async function readinessProbe(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check if application is ready to serve traffic
    const criticalChecks = await Promise.allSettled([
      checkDatabase(),
      checkAuth()
    ])

    const allHealthy = criticalChecks.every(check => 
      check.status === 'fulfilled' && check.value.status === 'healthy'
    )

    if (allHealthy) {
      res.status(200).json({ status: 'ready' })
    } else {
      res.status(503).json({ status: 'not ready' })
    }
  } catch (error) {
    res.status(503).json({ 
      status: 'not ready',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

// ==============================================
// LIVENESS PROBE
// ==============================================

export async function livenessProbe(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Simple liveness check - just verify the process is running
    res.status(200).json({ 
      status: 'alive',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    })
  } catch (error) {
    res.status(500).json({ 
      status: 'dead',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
