# Production Deployment Guide for SpiderInk.art

## 🚀 Deployment Overview

This guide covers the complete production deployment of SpiderInk.art with DirectorStudio integration, including environment setup, database migrations, and monitoring configuration.

## 📋 Pre-Deployment Checklist

### ✅ Code Quality Checks
- [ ] All TypeScript types are properly defined
- [ ] Error handling is implemented across all components
- [ ] Input validation is in place
- [ ] No console.log statements in production code
- [ ] All TODO comments are resolved
- [ ] Code is properly formatted and linted

### ✅ Security Checks
- [ ] Environment variables are properly configured
- [ ] API endpoints have proper authentication
- [ ] Input sanitization is implemented
- [ ] CORS is properly configured
- [ ] Rate limiting is in place

### ✅ Performance Checks
- [ ] Caching is implemented for frequently accessed data
- [ ] Database queries are optimized
- [ ] Images are optimized and compressed
- [ ] Bundle size is minimized
- [ ] CDN is configured for static assets

## 🔧 Environment Setup

### Required Environment Variables

Create a `.env.production` file with the following variables:

```bash
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Configuration
APP_UPLOAD_SECRET=your_secure_upload_secret_key
ADMIN_EMAIL_ALERT=admin@spiderink.art
CRON_SECRET=your_cron_secret_key

# Monitoring Configuration (Optional)
SENTRY_DSN=your_sentry_dsn
ANALYTICS_ENDPOINT=your_analytics_endpoint
ERROR_REPORTING_ENDPOINT=your_error_reporting_endpoint

# Performance Configuration
ENABLE_CACHING=true
CACHE_TTL=300000
SAMPLE_RATE=0.1

# Security Configuration
HMAC_SECRET=your_hmac_secret_key
JWT_SECRET=your_jwt_secret_key
```

### Environment Variable Security

1. **Never commit sensitive keys to version control**
2. **Use different keys for different environments**
3. **Rotate keys regularly**
4. **Use environment-specific prefixes**

## 🗄️ Database Setup

### 1. Run Database Migrations

Execute the following SQL scripts in your Supabase dashboard:

```sql
-- Run 001_create_core_tables.sql
-- Run 001_directorstudio_integration.sql
```

### 2. Set Up Row Level Security (RLS)

Enable RLS on all tables and configure policies:

```sql
-- Enable RLS on all tables
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public access
CREATE POLICY "Public videos are viewable by everyone" ON videos
  FOR SELECT USING (is_public = true);

CREATE POLICY "Public projects are viewable by everyone" ON projects
  FOR SELECT USING (is_public = true);

-- Create policies for user-specific data
CREATE POLICY "Users can view own collections" ON collections
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own collections" ON collections
  FOR ALL USING (auth.uid() = user_id);
```

### 3. Set Up Storage Buckets

```sql
-- Create storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES
  ('videos', 'videos', true),
  ('projects', 'projects', false),
  ('thumbnails', 'thumbnails', true);

-- Set up storage policies
CREATE POLICY "Public videos are viewable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'videos');

CREATE POLICY "Public thumbnails are viewable by everyone" ON storage.objects
  FOR SELECT USING (bucket_id = 'thumbnails');
```

## 🚀 Deployment Steps

### 1. Vercel Deployment

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy to production
vercel --prod

# Set environment variables
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add APP_UPLOAD_SECRET
vercel env add ADMIN_EMAIL_ALERT
vercel env add CRON_SECRET
```

### 2. Configure Custom Domain

1. Go to Vercel Dashboard → Project Settings → Domains
2. Add your custom domain (e.g., `spiderink.art`)
3. Configure DNS records as instructed
4. Enable SSL certificate

### 3. Set Up CDN

Configure Cloudflare or similar CDN service:

1. **Add your domain to Cloudflare**
2. **Configure caching rules:**
   - Static assets: Cache for 1 year
   - API responses: Cache for 5 minutes
   - HTML pages: Cache for 1 hour
3. **Enable compression**
4. **Configure security headers**

## 📊 Monitoring Setup

### 1. Error Tracking with Sentry

```bash
# Install Sentry
npm install @sentry/nextjs

# Configure Sentry in next.config.js
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig({
  // Your existing Next.js config
}, {
  // Sentry config
  org: 'your-org',
  project: 'spiderink-art',
  silent: true,
})
```

### 2. Performance Monitoring

Set up monitoring endpoints:

```typescript
// pages/api/monitoring/health.ts
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
  })
}
```

### 3. Analytics Setup

Configure Google Analytics or similar:

```typescript
// lib/analytics.ts
export const analytics = {
  track: (event: string, properties?: any) => {
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', event, properties)
    }
  }
}
```

## 🧪 Testing Strategy

### 1. Automated Testing

```bash
# Install testing dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run tests
npm run test

# Run tests with coverage
npm run test:coverage
```

### 2. End-to-End Testing

```bash
# Install Playwright
npm install --save-dev @playwright/test

# Run E2E tests
npx playwright test
```

### 3. Load Testing

```bash
# Install Artillery
npm install -g artillery

# Run load tests
artillery run load-test.yml
```

### 4. Security Testing

```bash
# Install security scanner
npm install -g npm-audit

# Run security audit
npm audit

# Fix vulnerabilities
npm audit fix
```

## 🔒 Security Configuration

### 1. HTTPS Configuration

Ensure all traffic is HTTPS:

```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          }
        ]
      }
    ]
  }
}
```

### 2. Rate Limiting

```typescript
// lib/rateLimit.ts
import { NextApiRequest, NextApiResponse } from 'next'

const rateLimit = (limit: number, windowMs: number) => {
  const requests = new Map()
  
  return (req: NextApiRequest, res: NextApiResponse) => {
    const ip = req.connection.remoteAddress
    const now = Date.now()
    const windowStart = now - windowMs
    
    // Clean old entries
    for (const [key, timestamp] of requests.entries()) {
      if (timestamp < windowStart) {
        requests.delete(key)
      }
    }
    
    // Check rate limit
    const requestCount = Array.from(requests.values())
      .filter(timestamp => timestamp > windowStart).length
    
    if (requestCount >= limit) {
      res.status(429).json({ error: 'Rate limit exceeded' })
      return false
    }
    
    requests.set(ip, now)
    return true
  }
}
```

## 📈 Performance Optimization

### 1. Image Optimization

```typescript
// next.config.js
module.exports = {
  images: {
    domains: ['your-supabase-domain.supabase.co'],
    formats: ['image/webp', 'image/avif'],
  }
}
```

### 2. Bundle Optimization

```typescript
// next.config.js
module.exports = {
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js']
  }
}
```

### 3. Caching Strategy

```typescript
// lib/cache.ts
export const cacheConfig = {
  videos: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100
  },
  projects: {
    ttl: 10 * 60 * 1000, // 10 minutes
    maxSize: 50
  },
  collections: {
    ttl: 15 * 60 * 1000, // 15 minutes
    maxSize: 200
  }
}
```

## 🚨 Monitoring & Alerting

### 1. Health Checks

Set up health check endpoints:

```typescript
// pages/api/health.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check database connection
    const { supabase } = await import('@/lib/supabaseClient')
    const { error } = await supabase.from('videos').select('id').limit(1)
    
    if (error) throw error
    
    res.status(200).json({
      status: 'healthy',
      database: 'connected',
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    })
  }
}
```

### 2. Uptime Monitoring

Configure uptime monitoring with services like:
- **UptimeRobot**
- **Pingdom**
- **StatusCake**

### 3. Error Alerting

Set up error alerts for:
- Database connection failures
- API endpoint errors
- High error rates
- Performance degradation

## 📋 Post-Deployment Checklist

### ✅ Functionality Tests
- [ ] User registration and login works
- [ ] Video upload and playback works
- [ ] Collections can be created and managed
- [ ] DirectorStudio integration works
- [ ] Admin dashboard is accessible
- [ ] API endpoints respond correctly

### ✅ Performance Tests
- [ ] Page load times are under 3 seconds
- [ ] API response times are under 500ms
- [ ] Database queries are optimized
- [ ] Caching is working effectively
- [ ] CDN is serving static assets

### ✅ Security Tests
- [ ] HTTPS is enforced
- [ ] Authentication is working
- [ ] Input validation prevents attacks
- [ ] Rate limiting is active
- [ ] Security headers are set

### ✅ Monitoring Tests
- [ ] Error tracking is working
- [ ] Performance monitoring is active
- [ ] Health checks are responding
- [ ] Alerts are configured
- [ ] Analytics are tracking events

## 🔄 Maintenance & Updates

### 1. Regular Maintenance Tasks

- **Weekly**: Review error logs and performance metrics
- **Monthly**: Update dependencies and security patches
- **Quarterly**: Review and optimize database queries
- **Annually**: Security audit and penetration testing

### 2. Backup Strategy

- **Database**: Daily automated backups
- **Files**: Daily backup of uploaded content
- **Configuration**: Version control for all config files

### 3. Scaling Strategy

- **Horizontal**: Add more Vercel instances
- **Vertical**: Upgrade Supabase plan
- **CDN**: Expand CDN coverage
- **Database**: Implement read replicas

## 🎯 Success Metrics

### Technical Metrics
- **Uptime**: > 99.9%
- **Response Time**: < 500ms average
- **Error Rate**: < 0.1%
- **Cache Hit Rate**: > 80%

### Business Metrics
- **User Registration**: Track daily signups
- **Video Uploads**: Monitor upload success rate
- **User Engagement**: Track session duration
- **Revenue**: Monitor transaction success rate

## 📞 Support & Documentation

### 1. User Documentation
- Create user guides for video upload
- Document DirectorStudio integration
- Provide troubleshooting guides

### 2. Developer Documentation
- API documentation
- Database schema documentation
- Deployment procedures

### 3. Support Channels
- Email support: support@spiderink.art
- Documentation: docs.spiderink.art
- Status page: status.spiderink.art

---

## 🎉 Deployment Complete!

Your SpiderInk.art platform is now ready for production with:
- ✅ Complete DirectorStudio integration
- ✅ Enterprise-grade security
- ✅ Performance optimization
- ✅ Comprehensive monitoring
- ✅ Scalable architecture

The platform is ready to handle thousands of users and millions of video views while maintaining high performance and reliability.
