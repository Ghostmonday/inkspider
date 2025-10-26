# DirectorStudio Integration - API Documentation

## Overview

This document provides the complete API specification for integrating DirectorStudio with SpiderInk.art. The integration enables AI-generated video projects to be seamlessly exported from DirectorStudio and displayed on the SpiderInk.art platform.

## Authentication & Security

### Required Headers

All POST requests must include the following headers:

```
Idempotency-Key: <unique-request-id>
X-Client-Signature: <hmac-sha256-signature>
X-Client-Version: 1.0.0
Content-Type: application/json
```

### HMAC Signature Generation

The `X-Client-Signature` header must contain an HMAC-SHA256 signature of the request body using your `APP_UPLOAD_SECRET`.

**Example (JavaScript):**
```javascript
const crypto = require('crypto');

function generateSignature(body, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

const signature = generateSignature(requestBody, APP_UPLOAD_SECRET);
```

## API Endpoints

### 1. Export Project

**POST** `/api/directostudio/export`

Exports a complete AI-generated video project from DirectorStudio to SpiderInk.art.

**Request Body:**
```json
{
  "project": {
    "id": "uuid",
    "user_id": "uuid",
    "film_title": "My AI Film",
    "description": "Film description",
    "director_notes": "Director's notes",
    "directorstudio_version": "1.0.0",
    "tokens_used": 1500,
    "continuity_score": 0.85,
    "is_public": true,
    "client_created_at": "2024-01-01T00:00:00Z",
    "idempotency_key": "unique-key"
  },
  "script_segments": [
    {
      "id": "uuid",
      "project_id": "uuid",
      "segment_order": 1,
      "scene_description": "Opening scene",
      "original_script_text": "Character walks into room",
      "duration": 5.5
    }
  ],
  "generation_metadata": [
    {
      "id": "uuid",
      "segment_id": "uuid",
      "ai_provider": "openai",
      "prompt_used": "Generate video of character walking",
      "continuity_notes": "Maintain lighting consistency",
      "actual_tokens_consumed": 500,
      "estimated_tokens": 450
    }
  ],
  "voiceover_sessions": [
    {
      "id": "uuid",
      "clip_id": "uuid",
      "take_number": 1,
      "timestamp_start": 0.0,
      "timestamp_end": 5.5,
      "audio_file_url": "https://storage.url/audio.mp3"
    }
  ],
  "transactions": [
    {
      "project_id": "uuid",
      "external_tx_id": "tx_123",
      "tokens_debited": 1500,
      "price_cents": 1500,
      "payment_provider": "stripe",
      "currency": "USD",
      "success": true,
      "client_created_at": "2024-01-01T00:00:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "project_url": "https://spiderink.art/project/uuid",
  "project_id": "uuid",
  "idempotency_key": "unique-key"
}
```

### 2. Presign Upload

**POST** `/api/upload/presign`

Generates a presigned URL for uploading files to Supabase storage.

**Request Body:**
```json
{
  "project_id": "uuid",
  "file_name": "video.mp4",
  "file_type": "video/mp4",
  "size": 10485760
}
```

**Response:**
```json
{
  "presigned_url": "https://storage.supabase.co/presigned-url",
  "file_path": "project-id/timestamp-randomid.mp4",
  "expires_at": "2024-01-01T00:05:00Z"
}
```

### 3. Complete Upload

**POST** `/api/upload/complete`

Marks an upload as complete and verifies the file.

**Request Body:**
```json
{
  "project_id": "uuid",
  "clip_id": "uuid",
  "file_url": "https://storage.supabase.co/file-path",
  "checksum": "sha256-hash"
}
```

**Response:**
```json
{
  "success": true,
  "upload_status": "verified",
  "file_url": "https://storage.supabase.co/file-path"
}
```

### 4. Create Transaction

**POST** `/api/transaction`

Records a payment transaction for token usage.

**Request Body:**
```json
{
  "project_id": "uuid",
  "external_tx_id": "tx_123",
  "tokens_debited": 1500,
  "price_cents": 1500,
  "payment_provider": "stripe",
  "currency": "USD",
  "success": true,
  "client_created_at": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "transaction_id": "uuid",
  "external_tx_id": "tx_123"
}
```

### 5. Get Project

**GET** `/api/project/[id]`

Retrieves a complete project with all metadata.

**Response:**
```json
{
  "project": {
    "id": "uuid",
    "film_title": "My AI Film",
    "description": "Film description",
    "tokens_used": 1500,
    "continuity_score": 0.85,
    "is_boosted": false,
    "user_profiles": {
      "username": "director_name",
      "avatar_url": "https://avatar.url",
      "is_director_verified": true
    },
    "script_segments": [...],
    "project_boosts": [...],
    "transactions": [...]
  },
  "reconciliation_status": {
    "project_id": "uuid",
    "tokens_expected": 1500,
    "tokens_actual": 1500,
    "discrepancy_percentage": 0.00
  }
}
```

### 6. List Projects

**GET** `/api/projects?user_id=&page=&filter=`

Retrieves a paginated list of projects with optional filtering.

**Query Parameters:**
- `user_id`: Filter by user ID
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20)
- `filter`: Filter type (`all`, `trending`, `boosted`, `recent`)

**Response:**
```json
{
  "projects": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "total_pages": 5
  }
}
```

### 7. Boost Project

**POST** `/api/projects/boost`

Boosts a project's visibility using credits.

**Request Body:**
```json
{
  "project_id": "uuid",
  "duration": "24h",
  "credits_spent": 5
}
```

**Response:**
```json
{
  "success": true,
  "boost_id": "uuid",
  "boost_end": "2024-01-02T00:00:00Z",
  "remaining_credits": 95
}
```

## Upload Workflow

### Complete Upload Process

1. **Request Presigned URL**
   ```bash
   curl -X POST /api/upload/presign \
     -H "Content-Type: application/json" \
     -d '{"project_id":"uuid","file_name":"video.mp4","file_type":"video/mp4","size":10485760}'
   ```

2. **Upload File Directly to Storage**
   ```bash
   curl -X PUT <presigned_url> \
     -H "Content-Type: video/mp4" \
     --data-binary @video.mp4
   ```

3. **Complete Upload**
   ```bash
   curl -X POST /api/upload/complete \
     -H "Content-Type: application/json" \
     -d '{"project_id":"uuid","clip_id":"uuid","file_url":"https://storage.url/file","checksum":"sha256-hash"}'
   ```

## Error Handling

### Common Error Responses

**400 Bad Request:**
```json
{
  "error": "Invalid request data",
  "details": [
    {
      "field": "film_title",
      "message": "Required field missing"
    }
  ]
}
```

**401 Unauthorized:**
```json
{
  "error": "Invalid signature"
}
```

**409 Conflict:**
```json
{
  "error": "Request already processed",
  "idempotency_key": "unique-key"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Internal server error"
}
```

## Testing

### Test Payloads

**Minimal Project Export:**
```json
{
  "project": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "user_id": "550e8400-e29b-41d4-a716-446655440001",
    "film_title": "Test Film",
    "directorstudio_version": "1.0.0",
    "tokens_used": 100,
    "continuity_score": 0.5,
    "is_public": true,
    "idempotency_key": "test-key-123"
  },
  "script_segments": [],
  "generation_metadata": [],
  "voiceover_sessions": [],
  "transactions": []
}
```

### Sample cURL Commands

**Export Project:**
```bash
curl -X POST https://spiderink.art/api/directostudio/export \
  -H "Idempotency-Key: test-123" \
  -H "X-Client-Signature: <hmac-signature>" \
  -H "X-Client-Version: 1.0.0" \
  -H "Content-Type: application/json" \
  -d @project-export.json
```

**Presign Upload:**
```bash
curl -X POST https://spiderink.art/api/upload/presign \
  -H "Content-Type: application/json" \
  -d '{"project_id":"550e8400-e29b-41d4-a716-446655440000","file_name":"test.mp4","file_type":"video/mp4","size":1000000}'
```

## Rate Limits

- **Export requests**: 10 per minute per user
- **Upload presign**: 50 per minute per user
- **Transaction creation**: 100 per minute per user

## Webhooks (Future)

Planned webhook events:
- `project.exported` - Project successfully exported
- `upload.completed` - File upload completed
- `boost.activated` - Project boost activated
- `reconciliation.issue` - Reconciliation discrepancy detected

## Support

For technical support or questions about the DirectorStudio integration:

- **Email**: support@spiderink.art
- **Documentation**: https://docs.spiderink.art
- **Status Page**: https://status.spiderink.art

