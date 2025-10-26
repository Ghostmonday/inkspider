// Upload Payload Validation for DirectorStudio
// Comprehensive validation of incoming upload payloads

import { UploadPayload, ValidationResult } from '@/types';

/**
 * Validate UUID format
 */
function isValidUUID(uuid: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
}

/**
 * Validate URL format
 */
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ['http:', 'https:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

/**
 * Validate number is within range
 */
function isInRange(value: number, min: number, max: number): boolean {
  return value >= min && value <= max;
}

/**
 * Validate upload payload structure and constraints
 */
export function validateUploadPayload(payload: any): ValidationResult {
  const errors: string[] = [];
  
  // Validate payload exists
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Invalid payload structure'] };
  }
  
  // =========================================================================
  // Validate Project
  // =========================================================================
  if (!payload.project || typeof payload.project !== 'object') {
    errors.push('Missing or invalid project object');
    return { isValid: false, errors };
  }
  
  const { project } = payload;
  
  // Required fields
  if (!project.id || !isValidUUID(project.id)) {
    errors.push('Invalid or missing project.id (must be UUID)');
  }
  
  if (!project.user_id || !isValidUUID(project.user_id)) {
    errors.push('Invalid or missing project.user_id (must be UUID)');
  }
  
  if (!project.title || typeof project.title !== 'string' || project.title.length === 0) {
    errors.push('Invalid or missing project.title');
  }
  
  if (project.title && project.title.length > 500) {
    errors.push('project.title too long (max 500 characters)');
  }
  
  if (!project.idempotency_key || typeof project.idempotency_key !== 'string') {
    errors.push('Invalid or missing project.idempotency_key');
  }
  
  // Optional numeric fields
  if (project.total_duration !== undefined && !isInRange(project.total_duration, 0, 36000)) {
    errors.push('project.total_duration out of range (0-36000 seconds)');
  }
  
  if (project.continuity_score !== undefined && !isInRange(project.continuity_score, 0, 100)) {
    errors.push('project.continuity_score out of range (0-100)');
  }
  
  if (project.tokens_used !== undefined && !isInRange(project.tokens_used, 0, 1000000)) {
    errors.push('project.tokens_used out of range (0-1000000)');
  }
  
  // Optional string fields
  if (project.film_title && project.film_title.length > 500) {
    errors.push('project.film_title too long (max 500 characters)');
  }
  
  if (project.description && project.description.length > 5000) {
    errors.push('project.description too long (max 5000 characters)');
  }
  
  // =========================================================================
  // Validate Clips
  // =========================================================================
  if (!Array.isArray(payload.clips) || payload.clips.length === 0) {
    errors.push('clips must be a non-empty array');
    return { isValid: false, errors };
  }
  
  if (payload.clips.length > 1000) {
    errors.push('Too many clips (max 1000)');
  }
  
  payload.clips.forEach((clip: any, index: number) => {
    const prefix = `clips[${index}]`;
    
    if (!clip.id || !isValidUUID(clip.id)) {
      errors.push(`${prefix}.id invalid or missing (must be UUID)`);
    }
    
    if (typeof clip.order_index !== 'number' || clip.order_index < 0) {
      errors.push(`${prefix}.order_index invalid (must be non-negative number)`);
    }
    
    if (!clip.file_url || !isValidUrl(clip.file_url)) {
      errors.push(`${prefix}.file_url invalid or missing (must be valid URL)`);
    }
    
    if (clip.thumbnail_url && !isValidUrl(clip.thumbnail_url)) {
      errors.push(`${prefix}.thumbnail_url invalid (must be valid URL)`);
    }
    
    if (clip.duration !== undefined && !isInRange(clip.duration, 0, 3600)) {
      errors.push(`${prefix}.duration out of range (0-3600 seconds)`);
    }
    
    if (clip.actual_tokens_consumed !== undefined && !isInRange(clip.actual_tokens_consumed, 0, 100000)) {
      errors.push(`${prefix}.actual_tokens_consumed out of range (0-100000)`);
    }
  });
  
  // =========================================================================
  // Validate Script Segments (Optional)
  // =========================================================================
  if (payload.script_segments !== undefined) {
    if (!Array.isArray(payload.script_segments)) {
      errors.push('script_segments must be an array');
    } else if (payload.script_segments.length > 1000) {
      errors.push('Too many script_segments (max 1000)');
    } else {
      payload.script_segments.forEach((segment: any, index: number) => {
        const prefix = `script_segments[${index}]`;
        
        if (typeof segment.segment_order !== 'number' || segment.segment_order < 0) {
          errors.push(`${prefix}.segment_order invalid (must be non-negative number)`);
        }
        
        if (segment.clip_id && !isValidUUID(segment.clip_id)) {
          errors.push(`${prefix}.clip_id invalid (must be UUID or null)`);
        }
        
        if (segment.scene_description && segment.scene_description.length > 5000) {
          errors.push(`${prefix}.scene_description too long (max 5000 characters)`);
        }
        
        if (segment.original_script_text && segment.original_script_text.length > 10000) {
          errors.push(`${prefix}.original_script_text too long (max 10000 characters)`);
        }
        
        if (segment.duration !== undefined && !isInRange(segment.duration, 0, 3600)) {
          errors.push(`${prefix}.duration out of range (0-3600 seconds)`);
        }
      });
    }
  }
  
  // =========================================================================
  // Validate Generation Metadata (Optional)
  // =========================================================================
  if (payload.generation_metadata !== undefined) {
    if (!Array.isArray(payload.generation_metadata)) {
      errors.push('generation_metadata must be an array');
    } else if (payload.generation_metadata.length > 1000) {
      errors.push('Too many generation_metadata entries (max 1000)');
    } else {
      payload.generation_metadata.forEach((meta: any, index: number) => {
        const prefix = `generation_metadata[${index}]`;
        
        if (!meta.clip_id || !isValidUUID(meta.clip_id)) {
          errors.push(`${prefix}.clip_id invalid or missing (must be UUID)`);
        }
        
        if (meta.prompt_used && meta.prompt_used.length > 10000) {
          errors.push(`${prefix}.prompt_used too long (max 10000 characters)`);
        }
        
        if (meta.continuity_notes && meta.continuity_notes.length > 5000) {
          errors.push(`${prefix}.continuity_notes too long (max 5000 characters)`);
        }
      });
    }
  }
  
  // =========================================================================
  // Validate Voiceover Sessions (Optional)
  // =========================================================================
  if (payload.voiceover_sessions !== undefined) {
    if (!Array.isArray(payload.voiceover_sessions)) {
      errors.push('voiceover_sessions must be an array');
    } else if (payload.voiceover_sessions.length > 1000) {
      errors.push('Too many voiceover_sessions (max 1000)');
    } else {
      payload.voiceover_sessions.forEach((session: any, index: number) => {
        const prefix = `voiceover_sessions[${index}]`;
        
        if (!session.clip_id || !isValidUUID(session.clip_id)) {
          errors.push(`${prefix}.clip_id invalid or missing (must be UUID)`);
        }
        
        if (!session.audio_url || !isValidUrl(session.audio_url)) {
          errors.push(`${prefix}.audio_url invalid or missing (must be valid URL)`);
        }
        
        if (session.duration !== undefined && !isInRange(session.duration, 0, 3600)) {
          errors.push(`${prefix}.duration out of range (0-3600 seconds)`);
        }
        
        if (session.take_number !== undefined && !isInRange(session.take_number, 1, 100)) {
          errors.push(`${prefix}.take_number out of range (1-100)`);
        }
      });
    }
  }
  
  // =========================================================================
  // Validate Transactions (Optional)
  // =========================================================================
  if (payload.transactions !== undefined) {
    if (!Array.isArray(payload.transactions)) {
      errors.push('transactions must be an array');
    } else if (payload.transactions.length > 100) {
      errors.push('Too many transactions (max 100)');
    } else {
      payload.transactions.forEach((tx: any, index: number) => {
        const prefix = `transactions[${index}]`;
        
        if (typeof tx.tokens_debited !== 'number' || tx.tokens_debited < 0) {
          errors.push(`${prefix}.tokens_debited invalid (must be non-negative number)`);
        }
        
        if (tx.price_cents !== undefined && (!Number.isInteger(tx.price_cents) || tx.price_cents < 0)) {
          errors.push(`${prefix}.price_cents invalid (must be non-negative integer)`);
        }
        
        if (typeof tx.success !== 'boolean') {
          errors.push(`${prefix}.success invalid (must be boolean)`);
        }
        
        if (tx.external_tx_id && typeof tx.external_tx_id !== 'string') {
          errors.push(`${prefix}.external_tx_id invalid (must be string)`);
        }
      });
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate presign request
 */
export function validatePresignRequest(payload: any): ValidationResult {
  const errors: string[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Invalid payload structure'] };
  }
  
  if (!payload.filename || typeof payload.filename !== 'string') {
    errors.push('Invalid or missing filename');
  }
  
  if (!payload.contentType || typeof payload.contentType !== 'string') {
    errors.push('Invalid or missing contentType');
  }
  
  // Validate content type
  const validTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'audio/mpeg', 'audio/wav', 'audio/ogg'];
  if (payload.contentType && !validTypes.includes(payload.contentType)) {
    errors.push(`Invalid contentType (must be one of: ${validTypes.join(', ')})`);
  }
  
  if (typeof payload.fileSize !== 'number' || payload.fileSize <= 0 || payload.fileSize > 5 * 1024 * 1024 * 1024) {
    errors.push('Invalid fileSize (must be between 1 byte and 5GB)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate upload complete request
 */
export function validateUploadCompleteRequest(payload: any): ValidationResult {
  const errors: string[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Invalid payload structure'] };
  }
  
  if (!payload.clipId || !isValidUUID(payload.clipId)) {
    errors.push('Invalid or missing clipId (must be UUID)');
  }
  
  if (!payload.filePath || typeof payload.filePath !== 'string') {
    errors.push('Invalid or missing filePath');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validate boost request
 */
export function validateBoostRequest(payload: any): ValidationResult {
  const errors: string[] = [];
  
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, errors: ['Invalid payload structure'] };
  }
  
  if (!payload.project_id || !isValidUUID(payload.project_id)) {
    errors.push('Invalid or missing project_id (must be UUID)');
  }
  
  if (!payload.duration || !['24h', '7d'].includes(payload.duration)) {
    errors.push('Invalid or missing duration (must be "24h" or "7d")');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}
