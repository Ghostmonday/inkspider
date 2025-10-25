# InkSpider

A full-stack video sharing platform built with Next.js and Supabase.

## Features

- **User Authentication**: Registration, login, and session management
- **Video Upload**: Upload MP4 videos with metadata (title, description, tags)
- **Public Feed**: Browse and view public videos
- **Video Interactions**: Like, comment, and view videos
- **User Dashboard**: Manage your videos and view credits
- **Collections**: Create and manage video collections
- **Credit System**: Track user credits for video uploads

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Backend**: Supabase (PostgreSQL, Authentication, Storage)
- **Styling**: No external CSS frameworks (functional focus)

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/inkspider.git
cd inkspider
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.local.example .env.local
```

4. Update `.env.local` with your Supabase credentials:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Database Schema

The application uses the following Supabase tables:

- `videos` - Video metadata and file URLs
- `user_profiles` - User profile information
- `user_credits` - User credit balances
- `credit_transactions` - Credit transaction history
- `video_likes` - Video like relationships
- `video_comments` - Video comments
- `video_tags` - Video tags
- `video_collections` - User collections
- `collection_items` - Videos in collections

## API Routes

- `/` - Public video feed
- `/login` - User login
- `/register` - User registration
- `/upload` - Video upload form
- `/dashboard` - User dashboard
- `/video/[id]` - Video details page
- `/collections` - User collections
- `/collections/[id]` - Collection details

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the ISC License.
