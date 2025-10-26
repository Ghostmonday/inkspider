# DirectorStudio Ecosystem

A professional video production and project management platform built with Next.js and Supabase.

Transforming creative vision into reality through intelligent production management.

## Features

### Core Production Management
- **Project Management**: Organize productions, scenes, and takes
- **Asset Library**: Advanced media organization with tagging and metadata
- **Production Pipeline**: Workflow management from pre-production to final delivery
- **Timeline & Storyboard**: Visual production planning and sequencing

### Team Collaboration
- **Role-Based Access**: Director, Producer, Editor, Crew permissions
- **Team Assignments**: Task delegation and progress tracking
- **Real-time Collaboration**: Share feedback and annotations
- **Version Control**: Track asset versions and production iterations

### Professional Tools
- **Credit System**: Production budget and resource allocation
- **Analytics Dashboard**: Production metrics and insights
- **Video Interactions**: Reviews, comments, and approvals
- **Collections**: Organize assets by project, scene, or category

### User Management
- **Authentication**: Secure registration and session management
- **User Profiles**: Role-based profiles with production history
- **Dashboard**: Centralized production control center

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
git clone https://github.com/yourusername/directorstudio.git
cd directorstudio
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
