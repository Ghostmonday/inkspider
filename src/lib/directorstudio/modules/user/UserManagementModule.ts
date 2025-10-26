// MODULE: User Management Module
// VERSION: 1.0.0
// PURPOSE: Advanced user management with DirectorStudio integration

import { PipelineModule, ModuleConfig, ValidationResult } from '../../core/types';
import { logEvent, logError } from '../../core/telemetry';

export interface UserManagementData {
  action: 'create' | 'update' | 'delete' | 'authenticate' | 'authorize';
  userId?: string;
  userData?: {
    email: string;
    username: string;
    displayName?: string;
    avatar?: string;
    preferences?: UserPreferences;
    permissions?: UserPermissions;
  };
  sessionId: string;
  context?: Record<string, any>;
}

export interface UserManagementResult {
  success: boolean;
  userId?: string;
  user?: UserProfile;
  session?: UserSession;
  permissions?: UserPermissions;
  credits?: number;
  message?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar?: string;
  preferences: UserPreferences;
  permissions: UserPermissions;
  credits: number;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
  isActive: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    inApp: boolean;
  };
  privacy: {
    profileVisibility: 'public' | 'private' | 'friends';
    showEmail: boolean;
    showActivity: boolean;
  };
  video: {
    defaultQuality: 'low' | 'medium' | 'high' | 'ultra';
    autoPlay: boolean;
    subtitles: boolean;
  };
}

export interface UserPermissions {
  canUpload: boolean;
  canCreateCollections: boolean;
  canModerate: boolean;
  canAdmin: boolean;
  maxUploadSize: number;
  maxVideosPerDay: number;
  allowedFormats: string[];
}

export interface UserSession {
  id: string;
  userId: string;
  sessionId: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
}

export class UserManagementModule implements PipelineModule {
  public readonly version = "1.0.0";
  public readonly name = "UserManagementModule";
  public readonly dependencies: string[] = [];
  public readonly config: ModuleConfig;

  private users: Map<string, UserProfile> = new Map();
  private sessions: Map<string, UserSession> = new Map();

  constructor(config?: Partial<ModuleConfig>) {
    this.config = {
      enabled: true,
      priority: 1,
      timeout: 30000,
      retries: 3,
      metadata: {
        defaultCredits: 100,
        sessionTimeout: 24 * 60 * 60 * 1000, // 24 hours
        maxSessionsPerUser: 5,
        ...config?.metadata
      },
      ...config
    };
  }

  async initialize(): Promise<void> {
    logEvent('module_initialized', this.name, {
      version: this.version,
      defaultCredits: this.config.metadata.defaultCredits,
      sessionTimeout: this.config.metadata.sessionTimeout
    });
  }

  async process(input: UserManagementData): Promise<UserManagementResult> {
    const startTime = Date.now();
    
    logEvent('user_management_started', this.name, {
      action: input.action,
      userId: input.userId,
      sessionId: input.sessionId
    });

    try {
      let result: UserManagementResult;

      switch (input.action) {
        case 'create':
          result = await this.createUser(input);
          break;
        case 'update':
          result = await this.updateUser(input);
          break;
        case 'delete':
          result = await this.deleteUser(input);
          break;
        case 'authenticate':
          result = await this.authenticateUser(input);
          break;
        case 'authorize':
          result = await this.authorizeUser(input);
          break;
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      const executionTime = Date.now() - startTime;
      
      logEvent('user_management_completed', this.name, {
        action: input.action,
        success: result.success,
        executionTime
      });

      return result;

    } catch (error) {
      logError(this.name, error as Error, {
        action: input.action,
        userId: input.userId,
        sessionId: input.sessionId
      });
      throw error;
    }
  }

  async validate(): Promise<ValidationResult> {
    const errors: any[] = [];
    const warnings: any[] = [];

    // Check configuration
    if (typeof this.config.metadata.defaultCredits !== 'number' || this.config.metadata.defaultCredits < 0) {
      errors.push({
        code: 'INVALID_DEFAULT_CREDITS',
        message: 'Default credits must be a non-negative number',
        severity: 'error',
        module: this.name,
        timestamp: new Date()
      });
    }

    if (typeof this.config.metadata.sessionTimeout !== 'number' || this.config.metadata.sessionTimeout <= 0) {
      errors.push({
        code: 'INVALID_SESSION_TIMEOUT',
        message: 'Session timeout must be a positive number',
        severity: 'error',
        module: this.name,
        timestamp: new Date()
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      metrics: {
        executionTime: 0,
        memoryUsage: 0,
        cpuUsage: 0,
        throughput: 0
      }
    };
  }

  async cleanup(): Promise<void> {
    logEvent('module_cleanup', this.name, {});
  }

  private async createUser(input: UserManagementData): Promise<UserManagementResult> {
    if (!input.userData) {
      throw new Error('User data is required for create action');
    }

    const { email, username, displayName, avatar, preferences, permissions } = input.userData;

    // Check if user already exists
    const existingUser = Array.from(this.users.values()).find(
      user => user.email === email || user.username === username
    );

    if (existingUser) {
      return {
        success: false,
        message: 'User already exists with this email or username'
      };
    }

    // Create new user
    const userId = this.generateUserId();
    const user: UserProfile = {
      id: userId,
      email,
      username,
      displayName: displayName || username,
      avatar,
      preferences: this.getDefaultPreferences(preferences),
      permissions: this.getDefaultPermissions(permissions),
      credits: this.config.metadata.defaultCredits,
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };

    this.users.set(userId, user);

    logEvent('user_created', this.name, {
      userId,
      email,
      username
    });

    return {
      success: true,
      userId,
      user,
      message: 'User created successfully'
    };
  }

  private async updateUser(input: UserManagementData): Promise<UserManagementResult> {
    if (!input.userId) {
      throw new Error('User ID is required for update action');
    }

    const user = this.users.get(input.userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    if (input.userData) {
      // Update user data
      const updatedUser: UserProfile = {
        ...user,
        ...input.userData,
        id: user.id, // Don't allow ID changes
        updatedAt: new Date()
      };

      this.users.set(input.userId, updatedUser);

      logEvent('user_updated', this.name, {
        userId: input.userId,
        updatedFields: Object.keys(input.userData)
      });

      return {
        success: true,
        userId: input.userId,
        user: updatedUser,
        message: 'User updated successfully'
      };
    }

    return {
      success: false,
      message: 'No update data provided'
    };
  }

  private async deleteUser(input: UserManagementData): Promise<UserManagementResult> {
    if (!input.userId) {
      throw new Error('User ID is required for delete action');
    }

    const user = this.users.get(input.userId);
    if (!user) {
      return {
        success: false,
        message: 'User not found'
      };
    }

    // Soft delete - mark as inactive
    user.isActive = false;
    user.updatedAt = new Date();
    this.users.set(input.userId, user);

    // Remove all sessions for this user
    for (const [sessionId, session] of this.sessions) {
      if (session.userId === input.userId) {
        this.sessions.delete(sessionId);
      }
    }

    logEvent('user_deleted', this.name, {
      userId: input.userId
    });

    return {
      success: true,
      userId: input.userId,
      message: 'User deleted successfully'
    };
  }

  private async authenticateUser(input: UserManagementData): Promise<UserManagementResult> {
    if (!input.userData?.email) {
      throw new Error('Email is required for authentication');
    }

    const user = Array.from(this.users.values()).find(
      u => u.email === input.userData!.email && u.isActive
    );

    if (!user) {
      return {
        success: false,
        message: 'Invalid credentials'
      };
    }

    // Create session
    const session = this.createSession(user.id, input.sessionId);
    user.lastLoginAt = new Date();
    this.users.set(user.id, user);

    logEvent('user_authenticated', this.name, {
      userId: user.id,
      sessionId: input.sessionId
    });

    return {
      success: true,
      userId: user.id,
      user,
      session,
      permissions: user.permissions,
      credits: user.credits
    };
  }

  private async authorizeUser(input: UserManagementData): Promise<UserManagementResult> {
    if (!input.userId) {
      throw new Error('User ID is required for authorization');
    }

    const user = this.users.get(input.userId);
    if (!user || !user.isActive) {
      return {
        success: false,
        message: 'User not found or inactive'
      };
    }

    // Check session validity
    const session = this.sessions.get(input.sessionId);
    if (!session || !session.isActive || session.expiresAt < new Date()) {
      return {
        success: false,
        message: 'Invalid or expired session'
      };
    }

    logEvent('user_authorized', this.name, {
      userId: input.userId,
      sessionId: input.sessionId
    });

    return {
      success: true,
      userId: input.userId,
      user,
      session,
      permissions: user.permissions,
      credits: user.credits
    };
  }

  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDefaultPreferences(overrides?: Partial<UserPreferences>): UserPreferences {
    return {
      theme: 'auto',
      language: 'en',
      notifications: {
        email: true,
        push: true,
        inApp: true
      },
      privacy: {
        profileVisibility: 'public',
        showEmail: false,
        showActivity: true
      },
      video: {
        defaultQuality: 'medium',
        autoPlay: false,
        subtitles: false
      },
      ...overrides
    };
  }

  private getDefaultPermissions(overrides?: Partial<UserPermissions>): UserPermissions {
    return {
      canUpload: true,
      canCreateCollections: true,
      canModerate: false,
      canAdmin: false,
      maxUploadSize: 100 * 1024 * 1024, // 100MB
      maxVideosPerDay: 10,
      allowedFormats: ['mp4', 'mov', 'avi', 'mkv'],
      ...overrides
    };
  }

  private createSession(userId: string, sessionId: string): UserSession {
    const now = new Date();
    const session: UserSession = {
      id: this.generateSessionId(),
      userId,
      sessionId,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this.config.metadata.sessionTimeout),
      isActive: true
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external access
  public getUser(userId: string): UserProfile | undefined {
    return this.users.get(userId);
  }

  public getSession(sessionId: string): UserSession | undefined {
    return this.sessions.get(sessionId);
  }

  public getAllUsers(): UserProfile[] {
    return Array.from(this.users.values());
  }

  public getActiveSessions(): UserSession[] {
    return Array.from(this.sessions.values()).filter(session => session.isActive);
  }
}
