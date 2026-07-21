'use client';

import React from 'react';
import { Card, Chip, Input } from '@heroui/react';
import { Button } from '@/components/ui/button';
import { Activity, Search, Shield, User, GitBranch, FileText, Building2, Sparkles } from 'lucide-react';
import { type ActivityItem } from '../../services/admin-dashboard.service';

export interface ActivityTimelineWidgetProps {
  items?: ActivityItem[] | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}

export function ActivityTimelineWidget({ items, isLoading, onRefresh }: ActivityTimelineWidgetProps) {
  const [filterCategory, setFilterCategory] = React.useState<string>('ALL');
  const [searchQuery, setSearchQuery] = React.useState<string>('');

  if (isLoading || !items) {
    return (
      <div className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-10 bg-surface-secondary rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  const filteredItems = items.filter(item => {
    const matchesCategory = filterCategory === 'ALL' || item.category.toUpperCase().includes(filterCategory.toUpperCase());
    const matchesSearch = !searchQuery ||
      item.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.actorName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const getCategoryIcon = (category: string) => {
    switch (category.toUpperCase()) {
      case 'USER': return <User className="w-3.5 h-3.5 text-accent" />;
      case 'REPOSITORY': return <GitBranch className="w-3.5 h-3.5 text-accent" />;
      case 'ORGANIZATION': return <Building2 className="w-3.5 h-3.5 text-accent" />;
      case 'AI': return <Sparkles className="w-3.5 h-3.5 text-accent" />;
      case 'SECURITY': return <Shield className="w-3.5 h-3.5 text-danger" />;
      default: return <FileText className="w-3.5 h-3.5 text-muted" />;
    }
  };

  const getStatusChipColor = (status: string) => {
    switch (status) {
      case 'Danger': return 'danger';
      case 'Warning': return 'warning';
      case 'Info': return 'accent';
      default: return 'success';
    }
  };

  return (
    <div className="space-y-4">
      {/* Category Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['ALL', 'User', 'Repository', 'Organization', 'AI', 'Security'].map(cat => (
            <Button
              key={cat}
              size="sm"
              variant={filterCategory === cat ? 'flat' : 'light'}
              color={filterCategory === cat ? 'primary' : 'default'}
              onPress={() => setFilterCategory(cat)}
              className="text-xs font-semibold px-3 cursor-pointer shrink-0"
            >
              {cat}
            </Button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-muted absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
          <Input
            placeholder="Search activity events..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8 text-xs"
          />
        </div>
      </div>

      {/* Live Stream List */}
      <div className="max-h-72 overflow-y-auto space-y-2 pr-1 font-mono text-xs select-none">
        {filteredItems.length === 0 ? (
          <div className="py-8 text-center text-muted font-sans text-xs">
            No activity events match your current filter query.
          </div>
        ) : (
          filteredItems.map(item => (
            <div
              key={item.id}
              className="p-3 rounded-xl bg-surface-secondary/70 hover:bg-surface-secondary transition-colors border border-separator/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
            >
              <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                <div className="p-1.5 rounded-lg bg-surface shrink-0 mt-0.5 sm:mt-0">
                  {getCategoryIcon(item.category)}
                </div>
                <div className="space-y-0.5 truncate font-sans">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-foreground text-xs">{item.action}</span>
                    <Chip size="sm" variant="soft" color={getStatusChipColor(item.status)} className="text-[10px] h-4 font-mono">
                      {item.status}
                    </Chip>
                  </div>
                  <p className="text-xs text-muted truncate">{item.description}</p>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-3 text-[11px] text-muted shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-separator/40 font-mono">
                <span className="truncate max-w-35 text-foreground/80">{item.actorName}</span>
                <span className="shrink-0">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
