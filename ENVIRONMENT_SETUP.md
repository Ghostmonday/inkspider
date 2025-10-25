# Environment Setup Guide

## Required Environment Variables

Your SpiderInk.art application requires the following environment variables for Supabase integration:

### Development (.env.local)
Create a `.env.local` file in the root directory with:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### Production (Vercel)
Add these environment variables in your Vercel dashboard:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Getting Supabase Credentials

1. Go to [supabase.com](https://supabase.com)
2. Sign in to your project
3. Go to Settings → API
4. Copy:
   - Project URL (for NEXT_PUBLIC_SUPABASE_URL)
   - anon/public key (for NEXT_PUBLIC_SUPABASE_ANON_KEY)

## Build Status

❌ **Current Status**: Build failing due to missing environment variables
✅ **Fix Required**: Set up environment variables before deployment

## Next Steps

1. Create `.env.local` with your Supabase credentials
2. Test build with `npm run build`
3. Deploy to Vercel with environment variables configured
