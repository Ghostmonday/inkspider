import { NextRequest } from 'next/server';
import { getDirectorStudioAPI } from '@/lib/directorstudio/api/gateway';

// Initialize DirectorStudio API with default configuration
const directorStudioConfig = {
  modules: {},
  telemetry: {
    enabled: true,
    endpoint: process.env.TELEMETRY_ENDPOINT || 'http://localhost:3000/api/telemetry',
    batchSize: 100,
    flushInterval: 30000,
    retentionDays: 90
  },
  continuity: {
    enabled: true,
    storage: 'memory' as const,
    ttl: 24 * 60 * 60 * 1000, // 24 hours
    maxEvents: 1000
  },
  validation: {
    strictMode: true,
    autoValidate: true,
    timeout: 30000,
    retries: 3
  }
};

const api = getDirectorStudioAPI(directorStudioConfig);

export async function POST(request: NextRequest) {
  return api.handleContentManagement(request);
}

export async function GET(request: NextRequest) {
  return api.handleContentManagement(request);
}

export async function PUT(request: NextRequest) {
  return api.handleContentManagement(request);
}

export async function DELETE(request: NextRequest) {
  return api.handleContentManagement(request);
}