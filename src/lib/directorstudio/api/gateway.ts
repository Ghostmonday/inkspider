// MODULE: DirectorStudio API Gateway
// VERSION: 1.0.0
// PURPOSE: Centralized API gateway for DirectorStudio ecosystem

import { NextRequest, NextResponse } from 'next/server';
import { PipelineEngine } from '../core/pipeline';
import { DirectorStudioConfig } from '../core/types';
import { logEvent, logError } from '../core/telemetry';

export class DirectorStudioAPI {
  private pipeline: PipelineEngine;
  private config: DirectorStudioConfig;

  constructor(config: DirectorStudioConfig) {
    this.config = config;
    this.pipeline = PipelineEngine.getInstance(config);
  }

  /**
   * Handle video upload API
   */
  async handleVideoUpload(request: NextRequest): Promise<NextResponse> {
    try {
      const formData = await request.formData();
      const file = formData.get('file') as File;
      const title = formData.get('title') as string;
      const description = formData.get('description') as string;
      const tags = formData.get('tags') as string;
      const isPublic = formData.get('isPublic') === 'true';
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

      if (!file || !title) {
        return NextResponse.json(
          { error: 'File and title are required' },
          { status: 400 }
        );
      }

      // Process through DirectorStudio pipeline
      const result = await this.pipeline.process({
        file,
        title,
        description,
        tags: tags ? tags.split(',').map(t => t.trim()) : [],
        isPublic,
        userId,
        sessionId
      }, sessionId, userId);

      logEvent('video_upload_api_success', 'DirectorStudioAPI', {
        userId,
        sessionId,
        videoId: result.videoId
      });

      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'video_upload',
        userId: request.headers.get('x-user-id')
      });

      return NextResponse.json(
        { error: 'Video upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle content management API
   */
  async handleContentManagement(request: NextRequest): Promise<NextResponse> {
    try {
      const { action, data } = await request.json();
      const userId = request.headers.get('x-user-id') || 'anonymous';
      const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

      if (!action) {
        return NextResponse.json(
          { error: 'Action is required' },
          { status: 400 }
        );
      }

      // Process through DirectorStudio pipeline
      const result = await this.pipeline.process({
        action,
        userId,
        sessionId,
        data
      }, sessionId, userId);

      logEvent('content_management_api_success', 'DirectorStudioAPI', {
        action,
        userId,
        sessionId
      });

      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'content_management',
        userId: request.headers.get('x-user-id')
      });

      return NextResponse.json(
        { error: 'Content management operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle analytics API
   */
  async handleAnalytics(request: NextRequest): Promise<NextResponse> {
    try {
      const { action, data } = await request.json();
      const userId = request.headers.get('x-user-id');
      const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

      if (!action) {
        return NextResponse.json(
          { error: 'Action is required' },
          { status: 400 }
        );
      }

      // Process through DirectorStudio pipeline
      const result = await this.pipeline.process({
        action,
        userId,
        sessionId,
        data
      }, sessionId, userId);

      logEvent('analytics_api_success', 'DirectorStudioAPI', {
        action,
        userId,
        sessionId
      });

      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'analytics',
        userId: request.headers.get('x-user-id')
      });

      return NextResponse.json(
        { error: 'Analytics operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle user management API
   */
  async handleUserManagement(request: NextRequest): Promise<NextResponse> {
    try {
      const { action, userData } = await request.json();
      const userId = request.headers.get('x-user-id');
      const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

      if (!action) {
        return NextResponse.json(
          { error: 'Action is required' },
          { status: 400 }
        );
      }

      // Process through DirectorStudio pipeline
      const result = await this.pipeline.process({
        action,
        userId,
        sessionId,
        data: { userData }
      }, sessionId, userId);

      logEvent('user_management_api_success', 'DirectorStudioAPI', {
        action,
        userId,
        sessionId
      });

      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'user_management',
        userId: request.headers.get('x-user-id')
      });

      return NextResponse.json(
        { error: 'User management operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle health check
   */
  async handleHealthCheck(): Promise<NextResponse> {
    try {
      const pipelineStatus = await this.pipeline.validateAllModules();
      const isHealthy = Array.from(pipelineStatus.values()).every(result => result.isValid);

      return NextResponse.json({
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        modules: Object.fromEntries(pipelineStatus),
        version: '1.0.0'
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'health_check'
      });

      return NextResponse.json(
        { status: 'unhealthy', error: 'Health check failed' },
        { status: 500 }
      );
    }
  }

  /**
   * Handle module management API
   */
  async handleModuleManagement(request: NextRequest): Promise<NextResponse> {
    try {
      const { action, moduleName, moduleConfig } = await request.json();
      const userId = request.headers.get('x-user-id');
      const sessionId = request.headers.get('x-session-id') || this.generateSessionId();

      if (!action) {
        return NextResponse.json(
          { error: 'Action is required' },
          { status: 400 }
        );
      }

      let result: any;

      switch (action) {
        case 'get_modules':
          result = this.pipeline.getModules();
          break;
        case 'get_module':
          if (!moduleName) {
            return NextResponse.json(
              { error: 'Module name is required' },
              { status: 400 }
            );
          }
          result = this.pipeline.getModule(moduleName);
          break;
        case 'validate_modules':
          result = await this.pipeline.validateAllModules();
          break;
        case 'get_config':
          result = this.pipeline.getConfig();
          break;
        case 'update_config':
          if (!moduleConfig) {
            return NextResponse.json(
              { error: 'Module configuration is required' },
              { status: 400 }
            );
          }
          this.pipeline.updateConfig(moduleConfig);
          result = { success: true, message: 'Configuration updated' };
          break;
        default:
          return NextResponse.json(
            { error: 'Unknown action' },
            { status: 400 }
          );
      }

      logEvent('module_management_api_success', 'DirectorStudioAPI', {
        action,
        userId,
        sessionId
      });

      return NextResponse.json({
        success: true,
        data: result
      });

    } catch (error) {
      logError('DirectorStudioAPI', error as Error, {
        operation: 'module_management',
        userId: request.headers.get('x-user-id')
      });

      return NextResponse.json(
        { error: 'Module management operation failed', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
let apiInstance: DirectorStudioAPI | null = null;

export const getDirectorStudioAPI = (config?: DirectorStudioConfig): DirectorStudioAPI => {
  if (!apiInstance && config) {
    apiInstance = new DirectorStudioAPI(config);
  }
  if (!apiInstance) {
    throw new Error('DirectorStudioAPI must be initialized with configuration');
  }
  return apiInstance;
};