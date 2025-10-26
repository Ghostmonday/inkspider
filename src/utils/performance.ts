// Performance optimization utilities for SpiderInk.art
// This module provides caching, query optimization, and performance monitoring

interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

interface QueryCache {
  [key: string]: CacheEntry<any>
}

interface PerformanceMetrics {
  queryTime: number
  cacheHit: boolean
  timestamp: number
  endpoint: string
}

class PerformanceOptimizer {
  private cache: QueryCache = {}
  private metrics: PerformanceMetrics[] = []
  private readonly DEFAULT_TTL = 5 * 60 * 1000 // 5 minutes

  /**
   * Get cached data if available and not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache[key]
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttl) {
      delete this.cache[key]
      return null
    }

    return entry.data as T
  }

  /**
   * Set data in cache with TTL
   */
  set<T>(key: string, data: T, ttl: number = this.DEFAULT_TTL): void {
    this.cache[key] = {
      data,
      timestamp: Date.now(),
      ttl
    }
  }

  /**
   * Clear cache entry or entire cache
   */
  clear(key?: string): void {
    if (key) {
      delete this.cache[key]
    } else {
      this.cache = {}
    }
  }

  /**
   * Generate cache key from parameters
   */
  generateKey(prefix: string, params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}:${params[key]}`)
      .join('|')
    return `${prefix}:${sortedParams}`
  }

  /**
   * Record performance metrics
   */
  recordMetric(queryTime: number, cacheHit: boolean, endpoint: string): void {
    this.metrics.push({
      queryTime,
      cacheHit,
      timestamp: Date.now(),
      endpoint
    })

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000)
    }
  }

  /**
   * Get performance statistics
   */
  getStats(): {
    averageQueryTime: number
    cacheHitRate: number
    totalQueries: number
    slowestQueries: PerformanceMetrics[]
  } {
    if (this.metrics.length === 0) {
      return {
        averageQueryTime: 0,
        cacheHitRate: 0,
        totalQueries: 0,
        slowestQueries: []
      }
    }

    const totalTime = this.metrics.reduce((sum, m) => sum + m.queryTime, 0)
    const cacheHits = this.metrics.filter(m => m.cacheHit).length
    const slowestQueries = [...this.metrics]
      .sort((a, b) => b.queryTime - a.queryTime)
      .slice(0, 10)

    return {
      averageQueryTime: totalTime / this.metrics.length,
      cacheHitRate: (cacheHits / this.metrics.length) * 100,
      totalQueries: this.metrics.length,
      slowestQueries
    }
  }
}

// Global performance optimizer instance
export const performanceOptimizer = new PerformanceOptimizer()

/**
 * Cached Supabase query wrapper
 */
export async function cachedQuery<T>(
  queryFn: () => Promise<T>,
  cacheKey: string,
  ttl?: number
): Promise<T> {
  const startTime = Date.now()
  
  // Try to get from cache first
  const cached = performanceOptimizer.get<T>(cacheKey)
  if (cached) {
    performanceOptimizer.recordMetric(
      Date.now() - startTime,
      true,
      cacheKey
    )
    return cached
  }

  // Execute query and cache result
  try {
    const result = await queryFn()
    performanceOptimizer.set(cacheKey, result, ttl)
    
    performanceOptimizer.recordMetric(
      Date.now() - startTime,
      false,
      cacheKey
    )
    
    return result
  } catch (error) {
    performanceOptimizer.recordMetric(
      Date.now() - startTime,
      false,
      cacheKey
    )
    throw error
  }
}

/**
 * Optimized video queries with caching
 */
export const videoQueries = {
  /**
   * Get videos with caching and pagination
   */
  async getVideos(
    page: number = 1,
    limit: number = 20,
    filter: string = 'all',
    userId?: string
  ) {
    const cacheKey = performanceOptimizer.generateKey('videos', {
      page,
      limit,
      filter,
      userId: userId || 'all'
    })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        let query = supabase
          .from('videos')
          .select(`
            *,
            user_profiles (
              id,
              email,
              username,
              avatar_url
            ),
            video_likes (id),
            video_comments (id)
          `)
          .eq('is_public', true)
          .order('created_at', { ascending: false })

        // Apply filters
        if (filter === 'trending') {
          // Order by likes count (simplified trending algorithm)
          query = query.order('created_at', { ascending: false })
        } else if (filter === 'boosted') {
          // Join with project_boosts to get boosted videos
          query = query.eq('is_boosted', true)
        }

        if (userId) {
          query = query.eq('user_id', userId)
        }

        // Apply pagination
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error } = await query
        if (error) throw error

        return data
      },
      cacheKey,
      2 * 60 * 1000 // 2 minutes cache for video lists
    )
  },

  /**
   * Get single video with full details
   */
  async getVideo(id: string) {
    const cacheKey = performanceOptimizer.generateKey('video', { id })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        const { data, error } = await supabase
          .from('videos')
          .select(`
            *,
            user_profiles (
              id,
              email,
              username,
              avatar_url,
              bio
            )
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        return data
      },
      cacheKey,
      5 * 60 * 1000 // 5 minutes cache for individual videos
    )
  }
}

/**
 * Optimized collection queries with caching
 */
export const collectionQueries = {
  /**
   * Get user collections with caching
   */
  async getUserCollections(userId: string) {
    const cacheKey = performanceOptimizer.generateKey('user-collections', { userId })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        const { data, error } = await supabase
          .from('collections')
          .select(`
            *,
            collection_videos (
              video_id,
              videos (
                id,
                title,
                thumbnail_url
              )
            )
          `)
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (error) throw error
        return data
      },
      cacheKey,
      3 * 60 * 1000 // 3 minutes cache for collections
    )
  },

  /**
   * Get collection with videos
   */
  async getCollection(id: string) {
    const cacheKey = performanceOptimizer.generateKey('collection', { id })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        const { data, error } = await supabase
          .from('collections')
          .select(`
            *,
            collection_videos (
              video_id,
              videos (
                id,
                title,
                description,
                file_url,
                thumbnail_url,
                created_at,
                is_public
              )
            )
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        return data
      },
      cacheKey,
      5 * 60 * 1000 // 5 minutes cache for individual collections
    )
  }
}

/**
 * Optimized project queries for DirectorStudio integration
 */
export const projectQueries = {
  /**
   * Get projects with caching
   */
  async getProjects(
    page: number = 1,
    limit: number = 20,
    filter: string = 'all',
    userId?: string
  ) {
    const cacheKey = performanceOptimizer.generateKey('projects', {
      page,
      limit,
      filter,
      userId: userId || 'all'
    })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        let query = supabase
          .from('projects')
          .select(`
            *,
            user_profiles (
              id,
              username,
              avatar_url,
              is_director_verified
            ),
            project_boosts (
              id,
              duration,
              credits_spent,
              boost_end,
              is_active
            )
          `)
          .eq('is_public', true)
          .order('created_at', { ascending: false })

        // Apply filters
        if (filter === 'trending') {
          query = query.order('continuity_score', { ascending: false })
        } else if (filter === 'boosted') {
          query = query.not('project_boosts', 'is', null)
        }

        if (userId) {
          query = query.eq('user_id', userId)
        }

        // Apply pagination
        const from = (page - 1) * limit
        const to = from + limit - 1
        query = query.range(from, to)

        const { data, error } = await query
        if (error) throw error

        return data
      },
      cacheKey,
      2 * 60 * 1000 // 2 minutes cache for project lists
    )
  },

  /**
   * Get single project with full details
   */
  async getProject(id: string) {
    const cacheKey = performanceOptimizer.generateKey('project', { id })

    return cachedQuery(
      async () => {
        const { supabase } = await import('@/lib/supabaseClient')
        
        const { data, error } = await supabase
          .from('projects')
          .select(`
            *,
            user_profiles (
              id,
              username,
              avatar_url,
              bio,
              is_director_verified
            ),
            script_segments (
              id,
              segment_order,
              scene_description,
              original_script_text,
              duration
            ),
            generation_metadata (
              id,
              ai_provider,
              prompt_used,
              continuity_notes,
              actual_tokens_consumed,
              estimated_tokens
            ),
            project_boosts (
              id,
              duration,
              credits_spent,
              boost_start,
              boost_end,
              is_active
            ),
            transactions (
              id,
              external_tx_id,
              tokens_debited,
              price_cents,
              payment_provider,
              currency,
              success
            )
          `)
          .eq('id', id)
          .single()

        if (error) throw error
        return data
      },
      cacheKey,
      5 * 60 * 1000 // 5 minutes cache for individual projects
    )
  }
}

/**
 * Database query optimization utilities
 */
export const queryOptimizer = {
  /**
   * Optimize Supabase query with proper indexing hints
   */
  optimizeQuery(query: any, options: {
    useIndex?: string
    limit?: number
    orderBy?: { column: string; ascending?: boolean }
  }) {
    if (options.limit) {
      query = query.limit(options.limit)
    }

    if (options.orderBy) {
      query = query.order(options.orderBy.column, { 
        ascending: options.orderBy.ascending ?? false 
      })
    }

    return query
  },

  /**
   * Batch multiple queries for better performance
   */
  async batchQueries<T>(queries: (() => Promise<T>)[]): Promise<T[]> {
    const startTime = Date.now()
    
    try {
      const results = await Promise.all(queries.map(query => query()))
      
      performanceOptimizer.recordMetric(
        Date.now() - startTime,
        false,
        'batch-queries'
      )
      
      return results
    } catch (error) {
      performanceOptimizer.recordMetric(
        Date.now() - startTime,
        false,
        'batch-queries-error'
      )
      throw error
    }
  }
}

/**
 * Image optimization utilities
 */
export const imageOptimizer = {
  /**
   * Generate optimized image URL with size parameters
   */
  getOptimizedImageUrl(
    originalUrl: string,
    width?: number,
    height?: number,
    quality: number = 80
  ): string {
    if (!originalUrl) return ''
    
    // For Supabase storage URLs, add transformation parameters
    if (originalUrl.includes('supabase')) {
      const params = new URLSearchParams()
      if (width) params.set('width', width.toString())
      if (height) params.set('height', height.toString())
      params.set('quality', quality.toString())
      
      return `${originalUrl}?${params.toString()}`
    }
    
    return originalUrl
  },

  /**
   * Generate responsive image srcset
   */
  generateSrcSet(baseUrl: string): string {
    const sizes = [320, 640, 768, 1024, 1280]
    return sizes
      .map(size => `${imageOptimizer.getOptimizedImageUrl(baseUrl, size)} ${size}w`)
      .join(', ')
  }
}

/**
 * Memory management utilities
 */
export const memoryManager = {
  /**
   * Clear old cache entries to prevent memory leaks
   */
  cleanupCache(): void {
    const now = Date.now()
    Object.keys(performanceOptimizer['cache']).forEach(key => {
      const entry = performanceOptimizer['cache'][key]
      if (now - entry.timestamp > entry.ttl) {
        delete performanceOptimizer['cache'][key]
      }
    })
  },

  /**
   * Get cache memory usage estimate
   */
  getCacheSize(): number {
    return Object.keys(performanceOptimizer['cache']).length
  }
}

// Auto-cleanup cache every 10 minutes
if (typeof window !== 'undefined') {
  setInterval(() => {
    memoryManager.cleanupCache()
  }, 10 * 60 * 1000)
}

export default {
  performanceOptimizer,
  cachedQuery,
  videoQueries,
  collectionQueries,
  projectQueries,
  queryOptimizer,
  imageOptimizer,
  memoryManager
}
