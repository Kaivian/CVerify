/**
 * Forum Telemetry & Analytics Instrumentation Module
 * Provides structured tracking for user engagement, search behavior, and interaction metrics.
 */

export type ForumTelemetryEvent =
  | 'forum_category_selected'
  | 'forum_search_executed'
  | 'forum_quick_filter_toggled'
  | 'forum_discussion_clicked'
  | 'forum_topic_upvoted'
  | 'forum_topic_bookmarked'
  | 'forum_create_discussion_clicked';

export interface ForumTelemetryPayload {
  categoryId?: string;
  categoryName?: string;
  searchQuery?: string;
  filterKey?: string;
  topicId?: string;
  topicSlug?: string;
  voteAction?: 'UPVOTE' | 'REMOVE';
  isBookmarked?: boolean;
  source?: string;
  [key: string]: unknown;
}

export function trackForumEvent(event: ForumTelemetryEvent, payload?: ForumTelemetryPayload): void {
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Forum Telemetry] ${event}:`, payload);
  }
  
  // Future telemetry providers (Segment, PostHog, Mixpanel, internal analytics API)
  if (typeof window !== 'undefined' && (window as any).gtag) {
    (window as any).gtag('event', event, payload);
  }
}
