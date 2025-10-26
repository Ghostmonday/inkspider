/** @type {import('next').NextConfig} */
const nextConfig = {
  // Production optimizations
  productionBrowserSourceMaps: false,
  compress: true,
  poweredByHeader: false,
  reactStrictMode: true,
  
  // Image optimization
  images: {
    domains: [
      process.env.NEXT_PUBLIC_SUPABASE_URL?.replace('https://', '').replace('http://', '') || 'localhost',
      'cdn.spiderink.art'
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=()'
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com",
              "img-src 'self' data: https: blob:",
              "media-src 'self' https: blob:",
              "connect-src 'self' https://*.supabase.co https://*.supabase.com https://www.google-analytics.com",
              "frame-src 'none'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'"
            ].join('; ')
          }
        ]
      }
    ]
  },

  // Redirects for SEO and user experience
  async redirects() {
    return [
      {
        source: '/home',
        destination: '/',
        permanent: true
      },
      {
        source: '/videos/:id',
        destination: '/video/:id',
        permanent: true
      },
      {
        source: '/admin',
        destination: '/admin/dashboard',
        permanent: false
      }
    ]
  },

  // Rewrites for API endpoints
  async rewrites() {
    return [
      {
        source: '/health',
        destination: '/api/health'
      },
      {
        source: '/metrics',
        destination: '/api/metrics'
      },
      {
        source: '/ready',
        destination: '/api/ready'
      },
      {
        source: '/live',
        destination: '/api/live'
      }
    ]
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },

  // Webpack configuration for production
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Production optimizations
    if (!dev && !isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            chunks: 'all',
          },
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            enforce: true,
          },
        },
      }
    }

    return config
  },

  // Experimental features
  experimental: {
    optimizeCss: true,
    optimizePackageImports: ['@supabase/supabase-js', 'react-icons'],
    serverComponentsExternalPackages: ['@supabase/supabase-js'],
  },

  // Output configuration
  output: 'standalone',
  
  // Trailing slash configuration
  trailingSlash: false,

  // TypeScript configuration
  typescript: {
    ignoreBuildErrors: false,
  },

  // ESLint configuration
  eslint: {
    ignoreDuringBuilds: false,
  },

  // Performance monitoring
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Build configuration
  generateBuildId: async () => {
    return `build-${Date.now()}`
  },

  // Custom server configuration
  serverRuntimeConfig: {
    // Will only be available on the server side
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    uploadSecret: process.env.APP_UPLOAD_SECRET,
  },

  publicRuntimeConfig: {
    // Will be available on both server and client
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  },
}

module.exports = nextConfig

