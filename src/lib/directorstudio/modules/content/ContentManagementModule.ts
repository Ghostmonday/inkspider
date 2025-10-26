// MODULE: Content Management Module
// VERSION: 1.0.0
// PURPOSE: Advanced content management with collections, playlists, and organization

import { PipelineModule, ModuleConfig, ValidationResult } from '../../core/types';
import { logEvent, logError } from '../../core/telemetry';

export interface ContentManagementData {
  action: 'create_collection' | 'update_collection' | 'delete_collection' | 
          'add_to_collection' | 'remove_from_collection' | 'get_collection' |
          'create_playlist' | 'update_playlist' | 'delete_playlist' |
          'add_to_playlist' | 'remove_from_playlist' | 'get_playlist' |
          'search_content' | 'get_user_content';
  userId: string;
  sessionId: string;
  data?: {
    collectionId?: string;
    playlistId?: string;
    videoId?: string;
    title?: string;
    description?: string;
    isPublic?: boolean;
    tags?: string[];
    searchQuery?: string;
    filters?: ContentFilters;
    pagination?: PaginationOptions;
  };
}

export interface ContentManagementResult {
  success: boolean;
  collection?: VideoCollection;
  playlist?: VideoPlaylist;
  videos?: VideoContent[];
  searchResults?: SearchResults;
  message?: string;
}

export interface VideoCollection {
  id: string;
  title: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  tags: string[];
  videoCount: number;
  videos: VideoContent[];
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
}

export interface VideoPlaylist {
  id: string;
  title: string;
  description?: string;
  userId: string;
  isPublic: boolean;
  videoCount: number;
  videos: PlaylistItem[];
  createdAt: Date;
  updatedAt: Date;
  thumbnailUrl?: string;
}

export interface PlaylistItem {
  videoId: string;
  video: VideoContent;
  position: number;
  addedAt: Date;
  notes?: string;
}

export interface VideoContent {
  id: string;
  title: string;
  description?: string;
  fileUrl: string;
  thumbnailUrl?: string;
  userId: string;
  isPublic: boolean;
  tags: string[];
  views: number;
  likes: number;
  comments: number;
  duration?: number;
  resolution?: string;
  fileSize: number;
  createdAt: Date;
  updatedAt: Date;
  analysis?: {
    objects?: string[];
    scenes?: string[];
    generatedTags?: string[];
    qualityScore?: number;
  };
}

export interface ContentFilters {
  tags?: string[];
  isPublic?: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
  duration?: {
    min: number;
    max: number;
  };
  quality?: string[];
  userId?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: 'createdAt' | 'updatedAt' | 'views' | 'likes' | 'title';
  sortOrder?: 'asc' | 'desc';
}

export interface SearchResults {
  videos: VideoContent[];
  collections: VideoCollection[];
  playlists: VideoPlaylist[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export class ContentManagementModule implements PipelineModule {
  public readonly version = "1.0.0";
  public readonly name = "ContentManagementModule";
  public readonly dependencies: string[] = ["UserManagementModule"];
  public readonly config: ModuleConfig;

  private collections: Map<string, VideoCollection> = new Map();
  private playlists: Map<string, VideoPlaylist> = new Map();
  private videos: Map<string, VideoContent> = new Map();

  constructor(config?: Partial<ModuleConfig>) {
    this.config = {
      enabled: true,
      priority: 2,
      timeout: 30000,
      retries: 3,
      metadata: {
        maxCollectionsPerUser: 50,
        maxPlaylistsPerUser: 100,
        maxVideosPerCollection: 1000,
        maxVideosPerPlaylist: 500,
        defaultPageSize: 20,
        maxPageSize: 100,
        ...config?.metadata
      },
      ...config
    };
  }

  async initialize(): Promise<void> {
    logEvent('module_initialized', this.name, {
      version: this.version,
      maxCollectionsPerUser: this.config.metadata.maxCollectionsPerUser,
      maxPlaylistsPerUser: this.config.metadata.maxPlaylistsPerUser
    });
  }

  async process(input: ContentManagementData): Promise<ContentManagementResult> {
    const startTime = Date.now();
    
    logEvent('content_management_started', this.name, {
      action: input.action,
      userId: input.userId,
      sessionId: input.sessionId
    });

    try {
      let result: ContentManagementResult;

      switch (input.action) {
        case 'create_collection':
          result = await this.createCollection(input);
          break;
        case 'update_collection':
          result = await this.updateCollection(input);
          break;
        case 'delete_collection':
          result = await this.deleteCollection(input);
          break;
        case 'add_to_collection':
          result = await this.addToCollection(input);
          break;
        case 'remove_from_collection':
          result = await this.removeFromCollection(input);
          break;
        case 'get_collection':
          result = await this.getCollection(input);
          break;
        case 'create_playlist':
          result = await this.createPlaylist(input);
          break;
        case 'update_playlist':
          result = await this.updatePlaylist(input);
          break;
        case 'delete_playlist':
          result = await this.deletePlaylist(input);
          break;
        case 'add_to_playlist':
          result = await this.addToPlaylist(input);
          break;
        case 'remove_from_playlist':
          result = await this.removeFromPlaylist(input);
          break;
        case 'get_playlist':
          result = await this.getPlaylist(input);
          break;
        case 'search_content':
          result = await this.searchContent(input);
          break;
        case 'get_user_content':
          result = await this.getUserContent(input);
          break;
        default:
          throw new Error(`Unknown action: ${input.action}`);
      }

      const executionTime = Date.now() - startTime;
      
      logEvent('content_management_completed', this.name, {
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
    if (typeof this.config.metadata.maxCollectionsPerUser !== 'number' || this.config.metadata.maxCollectionsPerUser <= 0) {
      errors.push({
        code: 'INVALID_MAX_COLLECTIONS',
        message: 'Max collections per user must be a positive number',
        severity: 'error',
        module: this.name,
        timestamp: new Date()
      });
    }

    if (typeof this.config.metadata.maxPlaylistsPerUser !== 'number' || this.config.metadata.maxPlaylistsPerUser <= 0) {
      errors.push({
        code: 'INVALID_MAX_PLAYLISTS',
        message: 'Max playlists per user must be a positive number',
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

  private async createCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.title) {
      throw new Error('Title is required for collection creation');
    }

    // Check user's collection limit
    const userCollections = Array.from(this.collections.values())
      .filter(c => c.userId === input.userId);
    
    if (userCollections.length >= this.config.metadata.maxCollectionsPerUser) {
      return {
        success: false,
        message: 'Maximum number of collections reached'
      };
    }

    const collection: VideoCollection = {
      id: this.generateId(),
      title: input.data.title,
      description: input.data.description,
      userId: input.userId,
      isPublic: input.data.isPublic || false,
      tags: input.data.tags || [],
      videoCount: 0,
      videos: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.collections.set(collection.id, collection);

    logEvent('collection_created', this.name, {
      collectionId: collection.id,
      userId: input.userId,
      title: collection.title
    });

    return {
      success: true,
      collection,
      message: 'Collection created successfully'
    };
  }

  private async updateCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.collectionId) {
      throw new Error('Collection ID is required for update');
    }

    const collection = this.collections.get(input.data.collectionId);
    if (!collection || collection.userId !== input.userId) {
      return {
        success: false,
        message: 'Collection not found or access denied'
      };
    }

    // Update collection
    if (input.data.title) collection.title = input.data.title;
    if (input.data.description !== undefined) collection.description = input.data.description;
    if (input.data.isPublic !== undefined) collection.isPublic = input.data.isPublic;
    if (input.data.tags) collection.tags = input.data.tags;
    collection.updatedAt = new Date();

    this.collections.set(collection.id, collection);

    logEvent('collection_updated', this.name, {
      collectionId: collection.id,
      userId: input.userId
    });

    return {
      success: true,
      collection,
      message: 'Collection updated successfully'
    };
  }

  private async deleteCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.collectionId) {
      throw new Error('Collection ID is required for deletion');
    }

    const collection = this.collections.get(input.data.collectionId);
    if (!collection || collection.userId !== input.userId) {
      return {
        success: false,
        message: 'Collection not found or access denied'
      };
    }

    this.collections.delete(input.data.collectionId);

    logEvent('collection_deleted', this.name, {
      collectionId: input.data.collectionId,
      userId: input.userId
    });

    return {
      success: true,
      message: 'Collection deleted successfully'
    };
  }

  private async addToCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.collectionId || !input.data?.videoId) {
      throw new Error('Collection ID and Video ID are required');
    }

    const collection = this.collections.get(input.data.collectionId);
    if (!collection || collection.userId !== input.userId) {
      return {
        success: false,
        message: 'Collection not found or access denied'
      };
    }

    const video = this.videos.get(input.data.videoId);
    if (!video) {
      return {
        success: false,
        message: 'Video not found'
      };
    }

    // Check if video is already in collection
    if (collection.videos.some(v => v.id === input.data!.videoId)) {
      return {
        success: false,
        message: 'Video already in collection'
      };
    }

    // Check collection size limit
    if (collection.videos.length >= this.config.metadata.maxVideosPerCollection) {
      return {
        success: false,
        message: 'Collection size limit reached'
      };
    }

    collection.videos.push(video);
    collection.videoCount = collection.videos.length;
    collection.updatedAt = new Date();

    this.collections.set(collection.id, collection);

    logEvent('video_added_to_collection', this.name, {
      collectionId: collection.id,
      videoId: input.data.videoId,
      userId: input.userId
    });

    return {
      success: true,
      collection,
      message: 'Video added to collection successfully'
    };
  }

  private async removeFromCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.collectionId || !input.data?.videoId) {
      throw new Error('Collection ID and Video ID are required');
    }

    const collection = this.collections.get(input.data.collectionId);
    if (!collection || collection.userId !== input.userId) {
      return {
        success: false,
        message: 'Collection not found or access denied'
      };
    }

    const videoIndex = collection.videos.findIndex(v => v.id === input.data!.videoId);
    if (videoIndex === -1) {
      return {
        success: false,
        message: 'Video not found in collection'
      };
    }

    collection.videos.splice(videoIndex, 1);
    collection.videoCount = collection.videos.length;
    collection.updatedAt = new Date();

    this.collections.set(collection.id, collection);

    logEvent('video_removed_from_collection', this.name, {
      collectionId: collection.id,
      videoId: input.data.videoId,
      userId: input.userId
    });

    return {
      success: true,
      collection,
      message: 'Video removed from collection successfully'
    };
  }

  private async getCollection(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.collectionId) {
      throw new Error('Collection ID is required');
    }

    const collection = this.collections.get(input.data.collectionId);
    if (!collection) {
      return {
        success: false,
        message: 'Collection not found'
      };
    }

    // Check if user has access (owner or public)
    if (collection.userId !== input.userId && !collection.isPublic) {
      return {
        success: false,
        message: 'Access denied'
      };
    }

    return {
      success: true,
      collection
    };
  }

  private async createPlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.title) {
      throw new Error('Title is required for playlist creation');
    }

    // Check user's playlist limit
    const userPlaylists = Array.from(this.playlists.values())
      .filter(p => p.userId === input.userId);
    
    if (userPlaylists.length >= this.config.metadata.maxPlaylistsPerUser) {
      return {
        success: false,
        message: 'Maximum number of playlists reached'
      };
    }

    const playlist: VideoPlaylist = {
      id: this.generateId(),
      title: input.data.title,
      description: input.data.description,
      userId: input.userId,
      isPublic: input.data.isPublic || false,
      videoCount: 0,
      videos: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.playlists.set(playlist.id, playlist);

    logEvent('playlist_created', this.name, {
      playlistId: playlist.id,
      userId: input.userId,
      title: playlist.title
    });

    return {
      success: true,
      playlist,
      message: 'Playlist created successfully'
    };
  }

  private async updatePlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.playlistId) {
      throw new Error('Playlist ID is required for update');
    }

    const playlist = this.playlists.get(input.data.playlistId);
    if (!playlist || playlist.userId !== input.userId) {
      return {
        success: false,
        message: 'Playlist not found or access denied'
      };
    }

    // Update playlist
    if (input.data.title) playlist.title = input.data.title;
    if (input.data.description !== undefined) playlist.description = input.data.description;
    if (input.data.isPublic !== undefined) playlist.isPublic = input.data.isPublic;
    playlist.updatedAt = new Date();

    this.playlists.set(playlist.id, playlist);

    logEvent('playlist_updated', this.name, {
      playlistId: playlist.id,
      userId: input.userId
    });

    return {
      success: true,
      playlist,
      message: 'Playlist updated successfully'
    };
  }

  private async deletePlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.playlistId) {
      throw new Error('Playlist ID is required for deletion');
    }

    const playlist = this.playlists.get(input.data.playlistId);
    if (!playlist || playlist.userId !== input.userId) {
      return {
        success: false,
        message: 'Playlist not found or access denied'
      };
    }

    this.playlists.delete(input.data.playlistId);

    logEvent('playlist_deleted', this.name, {
      playlistId: input.data.playlistId,
      userId: input.userId
    });

    return {
      success: true,
      message: 'Playlist deleted successfully'
    };
  }

  private async addToPlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.playlistId || !input.data?.videoId) {
      throw new Error('Playlist ID and Video ID are required');
    }

    const playlist = this.playlists.get(input.data.playlistId);
    if (!playlist || playlist.userId !== input.userId) {
      return {
        success: false,
        message: 'Playlist not found or access denied'
      };
    }

    const video = this.videos.get(input.data.videoId);
    if (!video) {
      return {
        success: false,
        message: 'Video not found'
      };
    }

    // Check if video is already in playlist
    if (playlist.videos.some(item => item.videoId === input.data!.videoId)) {
      return {
        success: false,
        message: 'Video already in playlist'
      };
    }

    // Check playlist size limit
    if (playlist.videos.length >= this.config.metadata.maxVideosPerPlaylist) {
      return {
        success: false,
        message: 'Playlist size limit reached'
      };
    }

    const playlistItem: PlaylistItem = {
      videoId: input.data.videoId,
      video,
      position: playlist.videos.length,
      addedAt: new Date()
    };

    playlist.videos.push(playlistItem);
    playlist.videoCount = playlist.videos.length;
    playlist.updatedAt = new Date();

    this.playlists.set(playlist.id, playlist);

    logEvent('video_added_to_playlist', this.name, {
      playlistId: playlist.id,
      videoId: input.data.videoId,
      userId: input.userId
    });

    return {
      success: true,
      playlist,
      message: 'Video added to playlist successfully'
    };
  }

  private async removeFromPlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.playlistId || !input.data?.videoId) {
      throw new Error('Playlist ID and Video ID are required');
    }

    const playlist = this.playlists.get(input.data.playlistId);
    if (!playlist || playlist.userId !== input.userId) {
      return {
        success: false,
        message: 'Playlist not found or access denied'
      };
    }

    const videoIndex = playlist.videos.findIndex(item => item.videoId === input.data!.videoId);
    if (videoIndex === -1) {
      return {
        success: false,
        message: 'Video not found in playlist'
      };
    }

    playlist.videos.splice(videoIndex, 1);
    
    // Reorder positions
    playlist.videos.forEach((item, index) => {
      item.position = index;
    });
    
    playlist.videoCount = playlist.videos.length;
    playlist.updatedAt = new Date();

    this.playlists.set(playlist.id, playlist);

    logEvent('video_removed_from_playlist', this.name, {
      playlistId: playlist.id,
      videoId: input.data.videoId,
      userId: input.userId
    });

    return {
      success: true,
      playlist,
      message: 'Video removed from playlist successfully'
    };
  }

  private async getPlaylist(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.playlistId) {
      throw new Error('Playlist ID is required');
    }

    const playlist = this.playlists.get(input.data.playlistId);
    if (!playlist) {
      return {
        success: false,
        message: 'Playlist not found'
      };
    }

    // Check if user has access (owner or public)
    if (playlist.userId !== input.userId && !playlist.isPublic) {
      return {
        success: false,
        message: 'Access denied'
      };
    }

    return {
      success: true,
      playlist
    };
  }

  private async searchContent(input: ContentManagementData): Promise<ContentManagementResult> {
    if (!input.data?.searchQuery) {
      throw new Error('Search query is required');
    }

    const query = input.data.searchQuery.toLowerCase();
    const filters = input.data.filters || {};
    const pagination = input.data.pagination || { page: 1, limit: this.config.metadata.defaultPageSize };

    // Search videos
    let matchingVideos = Array.from(this.videos.values()).filter(video => {
      if (!video.isPublic && video.userId !== input.userId) return false;
      if (filters.isPublic !== undefined && video.isPublic !== filters.isPublic) return false;
      if (filters.userId && video.userId !== filters.userId) return false;
      if (filters.tags && !filters.tags.some(tag => video.tags.includes(tag))) return false;
      
      return video.title.toLowerCase().includes(query) ||
             video.description?.toLowerCase().includes(query) ||
             video.tags.some(tag => tag.toLowerCase().includes(query));
    });

    // Search collections
    let matchingCollections = Array.from(this.collections.values()).filter(collection => {
      if (!collection.isPublic && collection.userId !== input.userId) return false;
      return collection.title.toLowerCase().includes(query) ||
             collection.description?.toLowerCase().includes(query) ||
             collection.tags.some(tag => tag.toLowerCase().includes(query));
    });

    // Search playlists
    let matchingPlaylists = Array.from(this.playlists.values()).filter(playlist => {
      if (!playlist.isPublic && playlist.userId !== input.userId) return false;
      return playlist.title.toLowerCase().includes(query) ||
             playlist.description?.toLowerCase().includes(query);
    });

    // Apply pagination to videos
    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    const paginatedVideos = matchingVideos.slice(startIndex, endIndex);

    const searchResults: SearchResults = {
      videos: paginatedVideos,
      collections: matchingCollections,
      playlists: matchingPlaylists,
      total: matchingVideos.length,
      page: pagination.page,
      limit: pagination.limit,
      hasMore: endIndex < matchingVideos.length
    };

    logEvent('content_search_completed', this.name, {
      query,
      userId: input.userId,
      resultsCount: searchResults.total
    });

    return {
      success: true,
      searchResults
    };
  }

  private async getUserContent(input: ContentManagementData): Promise<ContentManagementResult> {
    const pagination = input.data?.pagination || { page: 1, limit: this.config.metadata.defaultPageSize };
    
    const userVideos = Array.from(this.videos.values())
      .filter(video => video.userId === input.userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const startIndex = (pagination.page - 1) * pagination.limit;
    const endIndex = startIndex + pagination.limit;
    const paginatedVideos = userVideos.slice(startIndex, endIndex);

    logEvent('user_content_retrieved', this.name, {
      userId: input.userId,
      videoCount: paginatedVideos.length
    });

    return {
      success: true,
      videos: paginatedVideos
    };
  }

  private generateId(): string {
    return `content_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Public methods for external access
  public addVideo(video: VideoContent): void {
    this.videos.set(video.id, video);
  }

  public getVideo(videoId: string): VideoContent | undefined {
    return this.videos.get(videoId);
  }

  public getAllVideos(): VideoContent[] {
    return Array.from(this.videos.values());
  }

  public getAllCollections(): VideoCollection[] {
    return Array.from(this.collections.values());
  }

  public getAllPlaylists(): VideoPlaylist[] {
    return Array.from(this.playlists.values());
  }
}
