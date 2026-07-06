import { axiosClient } from './axios-client';

export interface UserMiniDto {
  id: string;
  fullName: string;
  username?: string;
  avatarUrl?: string;
  organizationName?: string;
  isCandidateVerified: boolean;
  isBusinessVerified: boolean;
  reputation: number;
}

export interface CategoryResponse {
  id: string;
  organizationId?: string;
  name: string;
  slug: string;
  description?: string;
  iconName?: string;
  displayOrder: number;
  isPrivate: boolean;
  isArchived: boolean;
  requiredRole?: string;
  createdAt: string;
}

export interface CreateCategoryRequest {
  name: string;
  slug?: string;
  description?: string;
  iconName?: string;
  displayOrder: number;
  isPrivate: boolean;
  requiredRole?: string;
}

export interface UpdateCategoryRequest extends CreateCategoryRequest {
  isArchived: boolean;
}

export interface TagResponse {
  id: string;
  name: string;
  slug: string;
  isArchived: boolean;
  topicCount: number;
}

export interface TopicListItemResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  organizationId?: string;
  author: UserMiniDto;
  title: string;
  slug: string;
  excerpt: string;
  aiExcerpt?: string;
  viewCount: number;
  replyCount: number;
  score: number;
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  isFeatured: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
  userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
  tags: string[];
  lastActivityAt: string;
  createdAt: string;
}

export interface ReactionCountDto {
  reactionType: string;
  count: number;
  userReacted: boolean;
}

export interface TopicResponse {
  id: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  organizationId?: string;
  author: UserMiniDto;
  title: string;
  slug: string;
  content: string;
  aiExcerpt?: string;
  viewCount: number;
  replyCount: number;
  score: number;
  isPinned: boolean;
  isLocked: boolean;
  isSolved: boolean;
  isFeatured: boolean;
  isBookmarked: boolean;
  isFollowing: boolean;
  userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
  tags: string[];
  reactions: ReactionCountDto[];
  lastActivityAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTopicRequest {
  categoryId: string;
  organizationId?: string;
  title: string;
  content: string;
  tags: string[];
}

export interface UpdateTopicRequest {
  title: string;
  content: string;
  tags: string[];
}

export interface CreateReplyRequest {
  content: string;
  parentReplyId?: string;
  quoteText?: string;
}

export interface UpdateReplyRequest {
  content: string;
}

export interface ReplyResponse {
  id: string;
  topicId: string;
  author: UserMiniDto;
  parentReplyId?: string;
  content: string;
  quoteText?: string;
  isAcceptedSolution: boolean;
  score: number;
  userVote?: 'UPVOTE' | 'DOWNVOTE' | null;
  reactions: ReactionCountDto[];
  childReplies: ReplyResponse[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateReportRequest {
  topicId?: string;
  replyId?: string;
  reportedUserId?: string;
  reason: string;
}

export interface ReportResponse {
  id: string;
  topicId?: string;
  topicTitle?: string;
  replyId?: string;
  replyExcerpt?: string;
  reportedUserId?: string;
  reportedUserName?: string;
  reporter: UserMiniDto;
  reason: string;
  status: string;
  resolutionNotes?: string;
  createdAt: string;
  resolvedAt?: string;
  resolvedByName?: string;
}

export interface ForumPagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

export interface ForumTopicSearchQuery {
  search?: string;
  categoryId?: string;
  organizationId?: string;
  tag?: string;
  filter?: string; // latest, trending, most_viewed, unanswered, solved, following, bookmarked
  page?: number;
  pageSize?: number;
}

export const forumApi = {
  // Categories
  getCategories: async (organizationId?: string): Promise<CategoryResponse[]> => {
    const url = organizationId ? `/v1/forum/categories?organizationId=${organizationId}` : '/v1/forum/categories';
    const response = await axiosClient.get<CategoryResponse[]>(url);
    return response.data;
  },

  getCategory: async (id: string): Promise<CategoryResponse> => {
    const response = await axiosClient.get<CategoryResponse>(`/v1/forum/categories/${id}`);
    return response.data;
  },

  createCategory: async (request: CreateCategoryRequest, organizationId?: string): Promise<CategoryResponse> => {
    const url = organizationId ? `/v1/forum/admin/categories?organizationId=${organizationId}` : '/v1/forum/admin/categories';
    const response = await axiosClient.post<CategoryResponse>(url, request);
    return response.data;
  },

  updateCategory: async (id: string, request: UpdateCategoryRequest): Promise<CategoryResponse> => {
    const response = await axiosClient.put<CategoryResponse>(`/v1/forum/admin/categories/${id}`, request);
    return response.data;
  },

  deleteCategory: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/forum/admin/categories/${id}`);
  },

  // Tags
  getTags: async (): Promise<TagResponse[]> => {
    const response = await axiosClient.get<TagResponse[]>('/v1/forum/tags');
    return response.data;
  },

  getTrendingTags: async (): Promise<TagResponse[]> => {
    const response = await axiosClient.get<TagResponse[]>('/v1/forum/tags/trending');
    return response.data;
  },

  mergeTags: async (source: string, target: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/admin/tags/merge?source=${source}&target=${target}`);
  },

  // Topics
  getTopics: async (query: ForumTopicSearchQuery): Promise<ForumPagedResult<TopicListItemResponse>> => {
    const params = new URLSearchParams();
    if (query.search) params.append('search', query.search);
    if (query.categoryId) params.append('categoryId', query.categoryId);
    if (query.organizationId) params.append('organizationId', query.organizationId);
    if (query.tag) params.append('tag', query.tag);
    if (query.filter) params.append('filter', query.filter);
    if (query.page) params.append('page', query.page.toString());
    if (query.pageSize) params.append('pageSize', query.pageSize.toString());

    const response = await axiosClient.get<ForumPagedResult<TopicListItemResponse>>(`/v1/forum/topics?${params.toString()}`);
    return response.data;
  },

  getTopic: async (slug: string): Promise<TopicResponse> => {
    const response = await axiosClient.get<TopicResponse>(`/v1/forum/topics/${slug}`);
    return response.data;
  },

  createTopic: async (request: CreateTopicRequest): Promise<TopicResponse> => {
    const response = await axiosClient.post<TopicResponse>('/v1/forum/topics', request);
    return response.data;
  },

  updateTopic: async (id: string, request: UpdateTopicRequest): Promise<TopicResponse> => {
    const response = await axiosClient.put<TopicResponse>(`/v1/forum/topics/${id}`, request);
    return response.data;
  },

  deleteTopic: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/forum/topics/${id}`);
  },

  voteTopic: async (id: string, voteType: 'UPVOTE' | 'DOWNVOTE' | 'LIKE' | 'HELPFUL' | 'INSIGHTFUL'): Promise<void> => {
    await axiosClient.post(`/v1/forum/topics/${id}/vote`, { voteType });
  },

  reactTopic: async (id: string, reactionType: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/topics/${id}/react`, { reactionType });
  },

  bookmarkTopic: async (id: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/topics/${id}/bookmark`);
  },

  followTopic: async (id: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/topics/${id}/follow`);
  },

  moderateTopic: async (id: string, action: string, reason?: string): Promise<TopicResponse> => {
    const response = await axiosClient.post<TopicResponse>(`/v1/forum/topics/${id}/moderation`, { action, reason });
    return response.data;
  },

  // Replies
  getReplies: async (topicId: string): Promise<ReplyResponse[]> => {
    const response = await axiosClient.get<ReplyResponse[]>(`/v1/forum/topics/${topicId}/replies`);
    return response.data;
  },

  createReply: async (topicId: string, request: CreateReplyRequest): Promise<ReplyResponse> => {
    const response = await axiosClient.post<ReplyResponse>(`/v1/forum/topics/${topicId}/replies`, request);
    return response.data;
  },

  updateReply: async (id: string, request: UpdateReplyRequest): Promise<ReplyResponse> => {
    const response = await axiosClient.put<ReplyResponse>(`/v1/forum/replies/${id}`, request);
    return response.data;
  },

  deleteReply: async (id: string): Promise<void> => {
    await axiosClient.delete(`/v1/forum/replies/${id}`);
  },

  acceptSolution: async (id: string): Promise<ReplyResponse> => {
    const response = await axiosClient.post<ReplyResponse>(`/v1/forum/replies/${id}/accept`);
    return response.data;
  },

  voteReply: async (id: string, voteType: 'UPVOTE' | 'DOWNVOTE' | 'LIKE' | 'HELPFUL' | 'INSIGHTFUL'): Promise<void> => {
    await axiosClient.post(`/v1/forum/replies/${id}/vote`, { voteType });
  },

  reactReply: async (id: string, reactionType: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/replies/${id}/react`, { reactionType });
  },

  // Moderation & Reports
  reportContent: async (request: CreateReportRequest): Promise<void> => {
    await axiosClient.post('/v1/forum/reports', request);
  },

  getReports: async (page = 1, pageSize = 20): Promise<ForumPagedResult<ReportResponse>> => {
    const response = await axiosClient.get<ForumPagedResult<ReportResponse>>(`/v1/forum/moderation/queue?page=${page}&pageSize=${pageSize}`);
    return response.data;
  },

  resolveReport: async (id: string, status: 'RESOLVED' | 'DISMISSED', resolutionNotes?: string): Promise<void> => {
    await axiosClient.post(`/v1/forum/moderation/resolve/${id}`, { status, resolutionNotes });
  },

  getCurrentUserProfile: async (): Promise<UserMiniDto> => {
    const response = await axiosClient.get<UserMiniDto>('/v1/forum/user/me');
    return response.data;
  },
};
