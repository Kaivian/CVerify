'use client';

import React, { useState } from 'react';
import {
  Card,
  Dropdown,
  Chip,
  Button,
  Kbd,
  Tooltip,
  Input,
  CloseButton
} from '@heroui/react';
import {
  Filter,
  RotateCcw,
  RefreshCw,
  Clock,
  Globe,
  Building2,
  Cpu,
  Server,
  Activity,
  ChevronDown,
  Check,
  Search,
  SlidersHorizontal,
  Pause
} from 'lucide-react';
import { useDashboardFilters } from '../context/admin-dashboard-filter.context';
import {
  TimeRangePreset,
  EnvironmentFilter,
  AiProviderFilter,
  RegionFilter,
  HealthStatusFilter
} from '../types/admin-dashboard-filter.types';

// Label and metadata helper dictionaries
const TIME_RANGE_LABELS: Record<TimeRangePreset, string> = {
  '10m': 'Last 10 minutes',
  '30m': 'Last 30 minutes',
  '1h': 'Last 1 hour',
  '6h': 'Last 6 hours',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  custom: 'Custom Range...'
};

const ENVIRONMENT_CONFIG: Record<EnvironmentFilter, { label: string; dotColor: string }> = {
  all: { label: 'All Environments', dotColor: 'bg-muted/50' },
  development: { label: 'Development', dotColor: 'bg-sky-500' },
  staging: { label: 'Staging', dotColor: 'bg-amber-500' },
  production: { label: 'Production', dotColor: 'bg-emerald-500' }
};

const AI_PROVIDER_LABELS: Record<AiProviderFilter, string> = {
  all: 'All Providers',
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  gemini: 'Google Gemini',
  local: 'Local Models'
};

const HEALTH_STATUS_CONFIG: Record<HealthStatusFilter, { label: string; dotColor: string }> = {
  all: { label: 'All Statuses', dotColor: 'bg-muted/50' },
  healthy: { label: 'Healthy', dotColor: 'bg-emerald-500' },
  warning: { label: 'Warning', dotColor: 'bg-amber-500' },
  critical: { label: 'Critical', dotColor: 'bg-rose-500' },
  offline: { label: 'Offline', dotColor: 'bg-slate-400' }
};

const ORG_LABELS: Record<string, string> = {
  all: 'All Organizations',
  'org-acme': 'Acme Enterprise Corp',
  'org-stark': 'Stark Tech Labs',
  'org-cyber': 'CyberDyne Systems'
};

const REGION_LABELS: Record<RegionFilter, string> = {
  all: 'All Regions & Nodes',
  'us-east': 'US East (N. Virginia)',
  'us-west': 'US West (Oregon)',
  'eu-central': 'EU Central (Frankfurt)',
  'ap-southeast': 'AP Southeast (Singapore)'
};

export function AdminDashboardFilterBar() {
  const {
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    triggerRefreshAll
  } = useDashboardFilters();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // Check if any advanced filter is currently active
  const isAdvancedActive = filters.organizationId !== 'all' || filters.region !== 'all';

  return (
    <Card className="p-3.5 sm:p-4 bg-surface/90 backdrop-blur-md border border-border/80 shadow-xs rounded-2xl space-y-3 font-outfit">
      {/* Main Top Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Core Filter Controls */}
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
          {/* Header Badge */}
          <div className="flex items-center gap-2 font-bold text-xs text-foreground uppercase tracking-wider shrink-0 select-none mr-1">
            <div className="p-1.5 rounded-lg bg-accent/10 text-accent">
              <Filter className="w-3.5 h-3.5" />
            </div>
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Chip size="sm" variant="soft" color="accent" className="h-5 text-[10px] font-extrabold px-1.5 border-none">
                <Chip.Label>{activeFilterCount}</Chip.Label>
              </Chip>
            )}
          </div>

          {/* Time Range Selector */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                size="sm"
                variant="outline"
                className={`text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                  filters.timeRange !== '24h'
                    ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                    : 'hover:bg-surface-secondary text-foreground'
                }`}
              >
                <Clock className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-80" />
                <span>{TIME_RANGE_LABELS[filters.timeRange]}</span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom start"
              className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[200px] z-50 animate-in fade-in duration-100 font-outfit"
            >
              <Dropdown.Menu
                aria-label="Time Range Presets"
                onAction={(key) => setFilter('timeRange', String(key) as TimeRangePreset)}
              >
                {(Object.keys(TIME_RANGE_LABELS) as TimeRangePreset[]).map((key) => {
                  const isSelected = filters.timeRange === key;
                  return (
                    <Dropdown.Item
                      key={key}
                      id={key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-bold'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <span>{TIME_RANGE_LABELS[key]}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Environment Selector */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                size="sm"
                variant="outline"
                className={`text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                  filters.environment !== 'all'
                    ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                    : 'hover:bg-surface-secondary text-foreground'
                }`}
              >
                <Globe className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-80" />
                <span className={`w-2 h-2 rounded-full mr-1 ${ENVIRONMENT_CONFIG[filters.environment].dotColor}`} />
                <span>
                  Env: {filters.environment === 'all' ? 'All' : ENVIRONMENT_CONFIG[filters.environment].label}
                </span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom start"
              className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[200px] z-50 animate-in fade-in duration-100 font-outfit"
            >
              <Dropdown.Menu
                aria-label="Environment Filter"
                onAction={(key) => setFilter('environment', String(key) as EnvironmentFilter)}
              >
                {(Object.keys(ENVIRONMENT_CONFIG) as EnvironmentFilter[]).map((key) => {
                  const isSelected = filters.environment === key;
                  const item = ENVIRONMENT_CONFIG[key];
                  return (
                    <Dropdown.Item
                      key={key}
                      id={key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-bold'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* AI Provider Filter */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                size="sm"
                variant="outline"
                className={`text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                  filters.aiProvider !== 'all'
                    ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                    : 'hover:bg-surface-secondary text-foreground'
                }`}
              >
                <Cpu className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-80" />
                <span>AI: {filters.aiProvider === 'all' ? 'All' : AI_PROVIDER_LABELS[filters.aiProvider]}</span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom start"
              className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[200px] z-50 animate-in fade-in duration-100 font-outfit"
            >
              <Dropdown.Menu
                aria-label="AI Provider Filter"
                onAction={(key) => setFilter('aiProvider', String(key) as AiProviderFilter)}
              >
                {(Object.keys(AI_PROVIDER_LABELS) as AiProviderFilter[]).map((key) => {
                  const isSelected = filters.aiProvider === key;
                  return (
                    <Dropdown.Item
                      key={key}
                      id={key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-bold'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <span>{AI_PROVIDER_LABELS[key]}</span>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Health Status Filter */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button
                size="sm"
                variant="outline"
                className={`text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                  filters.status !== 'all'
                    ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                    : 'hover:bg-surface-secondary text-foreground'
                }`}
              >
                <Activity className="w-3.5 h-3.5 mr-1.5 shrink-0 opacity-80" />
                <span className={`w-2 h-2 rounded-full mr-1 ${HEALTH_STATUS_CONFIG[filters.status].dotColor}`} />
                <span>
                  Status: {filters.status === 'all' ? 'All' : HEALTH_STATUS_CONFIG[filters.status].label}
                </span>
                <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Popover
              placement="bottom start"
              className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[200px] z-50 animate-in fade-in duration-100 font-outfit"
            >
              <Dropdown.Menu
                aria-label="Health Status Filter"
                onAction={(key) => setFilter('status', String(key) as HealthStatusFilter)}
              >
                {(Object.keys(HEALTH_STATUS_CONFIG) as HealthStatusFilter[]).map((key) => {
                  const isSelected = filters.status === key;
                  const item = HEALTH_STATUS_CONFIG[key];
                  return (
                    <Dropdown.Item
                      key={key}
                      id={key}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                        isSelected
                          ? 'bg-accent/10 text-accent font-bold'
                          : 'text-foreground hover:bg-surface-secondary'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${item.dotColor}`} />
                        <span>{item.label}</span>
                      </div>
                      {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                    </Dropdown.Item>
                  );
                })}
              </Dropdown.Menu>
            </Dropdown.Popover>
          </Dropdown>

          {/* Toggle Advanced Filters Button */}
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className={`text-xs font-semibold cursor-pointer h-8 transition-colors ${
              isAdvancedOpen || isAdvancedActive
                ? 'text-accent bg-accent/10 font-bold'
                : 'text-muted hover:text-foreground'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 mr-1" />
            <span>{isAdvancedOpen ? 'Fewer Filters' : 'More Filters'}</span>
            {isAdvancedActive && !isAdvancedOpen && (
              <span className="w-1.5 h-1.5 rounded-full bg-accent ml-1" />
            )}
          </Button>
        </div>

        {/* Right Side: Auto Refresh & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0 select-none">
          {/* Auto Refresh Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
            <span className="hidden md:inline text-[11px] font-semibold text-muted/80">Auto Refresh:</span>
            <Dropdown>
              <Dropdown.Trigger>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs font-semibold cursor-pointer border-border h-8 hover:bg-surface-secondary text-foreground"
                >
                  {filters.autoRefreshInterval > 0 ? (
                    <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-bold">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                      </span>
                      {filters.autoRefreshInterval}s
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-muted">
                      <Pause className="w-3 h-3" />
                      Paused
                    </span>
                  )}
                  <ChevronDown className="w-3 h-3 ml-1 opacity-60 shrink-0" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover
                placement="bottom end"
                className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[180px] z-50 animate-in fade-in duration-100 font-outfit"
              >
                <Dropdown.Menu
                  aria-label="Auto Refresh Interval"
                  onAction={(key) => setFilter('autoRefreshInterval', Number(key))}
                >
                  {[
                    { id: 10, label: 'Every 10 seconds' },
                    { id: 30, label: 'Every 30 seconds' },
                    { id: 60, label: 'Every 60 seconds' },
                    { id: 300, label: 'Every 5 minutes' },
                    { id: 0, label: 'Manual (Paused)' }
                  ].map((item) => {
                    const isSelected = filters.autoRefreshInterval === item.id;
                    return (
                      <Dropdown.Item
                        key={item.id}
                        id={String(item.id)}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-bold'
                            : 'text-foreground hover:bg-surface-secondary'
                        }`}
                      >
                        <span>{item.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          {/* Manual Refresh Button */}
          <Tooltip delay={0}>
            <Tooltip.Trigger>
              <Button
                isIconOnly
                size="sm"
                variant="outline"
                onPress={triggerRefreshAll}
                className="cursor-pointer border-border hover:border-accent/40 hover:bg-accent/5 hover:text-accent h-8 w-8 transition-colors"
                aria-label="Refresh All Widgets"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-overlay border border-border p-2 shadow-xl rounded-xl text-xs text-foreground z-50">
              Refresh Widgets (<Kbd>R</Kbd>)
            </Tooltip.Content>
          </Tooltip>

          {/* Reset Filters Button */}
          {activeFilterCount > 0 && (
            <Tooltip delay={0}>
              <Tooltip.Trigger>
                <Button
                  isIconOnly
                  size="sm"
                  variant="danger-soft"
                  onPress={resetFilters}
                  className="cursor-pointer h-8 w-8 text-danger hover:bg-danger/10 transition-colors"
                  aria-label="Reset All Filters"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-overlay border border-border p-2 shadow-xl rounded-xl text-xs text-foreground z-50">
                Reset Filters (<Kbd>Esc</Kbd>)
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Advanced Collapsible Filter Row */}
      {isAdvancedOpen && (
        <div className="pt-3 border-t border-separator/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 animate-in fade-in duration-150">
          {/* Organization Scope */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted block mb-1">
              Organization Scope
            </label>
            <Dropdown>
              <Dropdown.Trigger>
                <Button
                  size="sm"
                  variant="outline"
                  className={`w-full justify-between text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                    filters.organizationId !== 'all'
                      ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                      : 'hover:bg-surface-secondary text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{ORG_LABELS[filters.organizationId] || filters.organizationId}</span>
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0 ml-1" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover
                placement="bottom start"
                className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[220px] z-50 animate-in fade-in duration-100 font-outfit"
              >
                <Dropdown.Menu
                  aria-label="Organization Scope"
                  onAction={(key) => setFilter('organizationId', String(key))}
                >
                  {(Object.keys(ORG_LABELS) as string[]).map((key) => {
                    const isSelected = filters.organizationId === key;
                    return (
                      <Dropdown.Item
                        key={key}
                        id={key}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-bold'
                            : 'text-foreground hover:bg-surface-secondary'
                        }`}
                      >
                        <span>{ORG_LABELS[key]}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          {/* Region / Node */}
          <div>
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted block mb-1">
              Region / Infra Node
            </label>
            <Dropdown>
              <Dropdown.Trigger>
                <Button
                  size="sm"
                  variant="outline"
                  className={`w-full justify-between text-xs font-semibold cursor-pointer border-border h-8 transition-all ${
                    filters.region !== 'all'
                      ? 'border-accent/50 bg-accent/5 text-accent font-bold'
                      : 'hover:bg-surface-secondary text-foreground'
                  }`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <Server className="w-3.5 h-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{REGION_LABELS[filters.region] || filters.region}</span>
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-60 shrink-0 ml-1" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Popover
                placement="bottom start"
                className="bg-overlay border border-border/80 shadow-xl rounded-xl p-1.5 min-w-[220px] z-50 animate-in fade-in duration-100 font-outfit"
              >
                <Dropdown.Menu
                  aria-label="Region Filter"
                  onAction={(key) => setFilter('region', String(key) as RegionFilter)}
                >
                  {(Object.keys(REGION_LABELS) as RegionFilter[]).map((key) => {
                    const isSelected = filters.region === key;
                    return (
                      <Dropdown.Item
                        key={key}
                        id={key}
                        className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer select-none transition-colors ${
                          isSelected
                            ? 'bg-accent/10 text-accent font-bold'
                            : 'text-foreground hover:bg-surface-secondary'
                        }`}
                      >
                        <span>{REGION_LABELS[key]}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-accent shrink-0 ml-2" />}
                      </Dropdown.Item>
                    );
                  })}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown>
          </div>

          {/* Quick Search Input with Shortcut */}
          <div className="lg:col-span-2">
            <label className="text-[10px] font-extrabold uppercase tracking-wider text-muted block mb-1">
              Quick Filter Focus
            </label>
            <div className="relative flex items-center">
              <Search className="w-3.5 h-3.5 absolute left-2.5 text-muted pointer-events-none" />
              <Input
                id="admin-filter-bar-search"
                placeholder="Search widgets, logs, or metrics..."
                className="w-full text-xs h-8 pl-8 pr-16 border-border rounded-xl focus:border-accent"
              />
              <span className="absolute right-2 text-[10px] text-muted font-mono select-none pointer-events-none">
                <Kbd>Ctrl+K</Kbd>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Active Filters Badge Row */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-separator/70 select-none animate-in fade-in duration-150">
          <span className="text-[10px] font-extrabold text-muted uppercase tracking-wider mr-1">Active:</span>

          {filters.timeRange !== '24h' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>Time: {TIME_RANGE_LABELS[filters.timeRange]}</Chip.Label>
              <CloseButton onPress={() => setFilter('timeRange', '24h')} />
            </Chip>
          )}

          {filters.environment !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>Env: {ENVIRONMENT_CONFIG[filters.environment].label}</Chip.Label>
              <CloseButton onPress={() => setFilter('environment', 'all')} />
            </Chip>
          )}

          {filters.aiProvider !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>AI: {AI_PROVIDER_LABELS[filters.aiProvider]}</Chip.Label>
              <CloseButton onPress={() => setFilter('aiProvider', 'all')} />
            </Chip>
          )}

          {filters.status !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>Status: {HEALTH_STATUS_CONFIG[filters.status].label}</Chip.Label>
              <CloseButton onPress={() => setFilter('status', 'all')} />
            </Chip>
          )}

          {filters.organizationId !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>Org: {ORG_LABELS[filters.organizationId] || filters.organizationId}</Chip.Label>
              <CloseButton onPress={() => setFilter('organizationId', 'all')} />
            </Chip>
          )}

          {filters.region !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-6 rounded-lg">
              <Chip.Label>Region: {REGION_LABELS[filters.region] || filters.region}</Chip.Label>
              <CloseButton onPress={() => setFilter('region', 'all')} />
            </Chip>
          )}

          <Button
            size="sm"
            variant="ghost"
            onPress={resetFilters}
            className="text-[11px] font-bold text-danger hover:underline h-5 px-1.5 min-w-0 ml-1 cursor-pointer"
          >
            Clear All
          </Button>
        </div>
      )}
    </Card>
  );
}
