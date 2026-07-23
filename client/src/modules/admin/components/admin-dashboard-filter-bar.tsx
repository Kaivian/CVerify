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
  ChevronDown
} from 'lucide-react';
import { useDashboardFilters } from '../context/admin-dashboard-filter.context';
import {
  TimeRangePreset,
  EnvironmentFilter,
  AiProviderFilter,
  RegionFilter,
  HealthStatusFilter
} from '../types/admin-dashboard-filter.types';

export function AdminDashboardFilterBar() {
  const {
    filters,
    setFilter,
    resetFilters,
    activeFilterCount,
    triggerRefreshAll
  } = useDashboardFilters();

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  return (
    <Card className="p-4 bg-surface border border-border rounded-2xl shadow-sm space-y-3">
      {/* Top Main Filter Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Left Side: Search & Core Filters */}
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 font-bold text-xs text-foreground uppercase tracking-wider shrink-0 select-none">
            <Filter className="w-4 h-4 text-accent" />
            <span>Filters</span>
            {activeFilterCount > 0 && (
              <Chip size="sm" variant="soft" color="accent" className="h-5 text-[10px] font-bold px-1.5 border-none">
                <Chip.Label>{activeFilterCount}</Chip.Label>
              </Chip>
            )}
          </div>

          {/* Time Range Selector */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="outline" className="text-xs font-semibold cursor-pointer border-border h-8">
                <Clock className="w-3.5 h-3.5 mr-1 text-accent" />
                {filters.timeRange === '10m' && 'Last 10 minutes'}
                {filters.timeRange === '30m' && 'Last 30 minutes'}
                {filters.timeRange === '1h' && 'Last 1 hour'}
                {filters.timeRange === '6h' && 'Last 6 hours'}
                {filters.timeRange === '24h' && 'Last 24 hours'}
                {filters.timeRange === '7d' && 'Last 7 days'}
                {filters.timeRange === 'custom' && 'Custom Range'}
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu
              aria-label="Time Range Presets"
              onAction={(key) => setFilter('timeRange', String(key) as TimeRangePreset)}
            >
              <Dropdown.Item id="10m">Last 10 minutes</Dropdown.Item>
              <Dropdown.Item id="30m">Last 30 minutes</Dropdown.Item>
              <Dropdown.Item id="1h">Last 1 hour</Dropdown.Item>
              <Dropdown.Item id="6h">Last 6 hours</Dropdown.Item>
              <Dropdown.Item id="24h">Last 24 hours</Dropdown.Item>
              <Dropdown.Item id="7d">Last 7 days</Dropdown.Item>
              <Dropdown.Item id="custom">Custom Range...</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Environment Selector */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="outline" className="text-xs font-semibold cursor-pointer border-border h-8">
                <Globe className="w-3.5 h-3.5 mr-1 text-accent" />
                Env: {filters.environment === 'all' ? 'All' : filters.environment}
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu
              aria-label="Environment Filter"
              onAction={(key) => setFilter('environment', String(key) as EnvironmentFilter)}
            >
              <Dropdown.Item id="all">All Environments</Dropdown.Item>
              <Dropdown.Item id="development">Development</Dropdown.Item>
              <Dropdown.Item id="staging">Staging</Dropdown.Item>
              <Dropdown.Item id="production">Production</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* AI Provider Filter */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="outline" className="text-xs font-semibold cursor-pointer border-border h-8">
                <Cpu className="w-3.5 h-3.5 mr-1 text-accent" />
                AI: {filters.aiProvider === 'all' ? 'All Providers' : filters.aiProvider}
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu
              aria-label="AI Provider Filter"
              onAction={(key) => setFilter('aiProvider', String(key) as AiProviderFilter)}
            >
              <Dropdown.Item id="all">All Providers</Dropdown.Item>
              <Dropdown.Item id="openai">OpenAI</Dropdown.Item>
              <Dropdown.Item id="anthropic">Anthropic</Dropdown.Item>
              <Dropdown.Item id="gemini">Google Gemini</Dropdown.Item>
              <Dropdown.Item id="local">Local Models</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Status Filter */}
          <Dropdown>
            <Dropdown.Trigger>
              <Button size="sm" variant="outline" className="text-xs font-semibold cursor-pointer border-border h-8">
                <Activity className="w-3.5 h-3.5 mr-1 text-accent" />
                Status: {filters.status === 'all' ? 'All Statuses' : filters.status}
                <ChevronDown className="w-3 h-3 ml-1 opacity-70" />
              </Button>
            </Dropdown.Trigger>
            <Dropdown.Menu
              aria-label="Health Status Filter"
              onAction={(key) => setFilter('status', String(key) as HealthStatusFilter)}
            >
              <Dropdown.Item id="all">All Statuses</Dropdown.Item>
              <Dropdown.Item id="healthy">Healthy</Dropdown.Item>
              <Dropdown.Item id="warning">Warning</Dropdown.Item>
              <Dropdown.Item id="critical">Critical</Dropdown.Item>
              <Dropdown.Item id="offline">Offline</Dropdown.Item>
            </Dropdown.Menu>
          </Dropdown>

          {/* Toggle Advanced Filters Button */}
          <Button
            size="sm"
            variant="ghost"
            onPress={() => setIsAdvancedOpen(!isAdvancedOpen)}
            className="text-xs font-semibold cursor-pointer text-muted hover:text-foreground h-8"
          >
            {isAdvancedOpen ? 'Fewer Filters' : 'More Filters...'}
          </Button>
        </div>

        {/* Right Side: Auto Refresh & Quick Actions */}
        <div className="flex items-center gap-2 shrink-0 select-none">
          {/* Auto Refresh Dropdown */}
          <div className="flex items-center gap-1.5 text-xs text-muted font-medium">
            <span className="hidden sm:inline">Auto Refresh:</span>
            <Dropdown>
              <Dropdown.Trigger>
                <Button size="sm" variant="outline" className="text-xs font-semibold cursor-pointer border-border h-8">
                  {filters.autoRefreshInterval > 0 ? `${filters.autoRefreshInterval}s` : 'Paused'}
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Menu
                aria-label="Auto Refresh Interval"
                onAction={(key) => setFilter('autoRefreshInterval', Number(key))}
              >
                <Dropdown.Item id="10">Every 10 seconds</Dropdown.Item>
                <Dropdown.Item id="30">Every 30 seconds</Dropdown.Item>
                <Dropdown.Item id="60">Every 60 seconds</Dropdown.Item>
                <Dropdown.Item id="300">Every 5 minutes</Dropdown.Item>
                <Dropdown.Item id="0">Manual (Paused)</Dropdown.Item>
              </Dropdown.Menu>
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
                className="cursor-pointer border-border h-8 w-8"
              >
                <RefreshCw className="w-3.5 h-3.5 text-accent" />
              </Button>
            </Tooltip.Trigger>
            <Tooltip.Content className="bg-surface border border-border p-2 shadow-md rounded-lg text-xs text-foreground">
              Refresh All Widgets (<Kbd>R</Kbd>)
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
                  className="cursor-pointer h-8 w-8"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </Button>
              </Tooltip.Trigger>
              <Tooltip.Content className="bg-surface border border-border p-2 shadow-md rounded-lg text-xs text-foreground">
                Reset All Filters (<Kbd>Esc</Kbd>)
              </Tooltip.Content>
            </Tooltip>
          )}
        </div>
      </div>

      {/* Advanced Filter Row (Collapsible) */}
      {isAdvancedOpen && (
        <div className="pt-2 border-t border-separator grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Organization Scope */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Organization Scope
            </label>
            <Dropdown>
              <Dropdown.Trigger>
                <Button size="sm" variant="outline" className="w-full justify-between text-xs font-semibold cursor-pointer border-border h-8">
                  <span className="flex items-center gap-1.5 truncate">
                    <Building2 className="w-3.5 h-3.5 text-accent" />
                    {filters.organizationId === 'all' ? 'All Organizations' : filters.organizationId}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Menu
                aria-label="Organization Scope"
                onAction={(key) => setFilter('organizationId', String(key))}
              >
                <Dropdown.Item id="all">All Organizations</Dropdown.Item>
                <Dropdown.Item id="org-acme">Acme Enterprise Corp</Dropdown.Item>
                <Dropdown.Item id="org-stark">Stark Tech Labs</Dropdown.Item>
                <Dropdown.Item id="org-cyber">CyberDyne Systems</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {/* Region / Node */}
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Region / Infra Node
            </label>
            <Dropdown>
              <Dropdown.Trigger>
                <Button size="sm" variant="outline" className="w-full justify-between text-xs font-semibold cursor-pointer border-border h-8">
                  <span className="flex items-center gap-1.5 truncate">
                    <Server className="w-3.5 h-3.5 text-accent" />
                    {filters.region === 'all' ? 'All Regions' : filters.region.toUpperCase()}
                  </span>
                  <ChevronDown className="w-3 h-3 opacity-70 shrink-0" />
                </Button>
              </Dropdown.Trigger>
              <Dropdown.Menu
                aria-label="Region Filter"
                onAction={(key) => setFilter('region', String(key) as RegionFilter)}
              >
                <Dropdown.Item id="all">All Regions & Nodes</Dropdown.Item>
                <Dropdown.Item id="us-east">US East (N. Virginia)</Dropdown.Item>
                <Dropdown.Item id="us-west">US West (Oregon)</Dropdown.Item>
                <Dropdown.Item id="eu-central">EU Central (Frankfurt)</Dropdown.Item>
                <Dropdown.Item id="ap-southeast">AP Southeast (Singapore)</Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          </div>

          {/* Search Input with Keyboard Hint */}
          <div className="lg:col-span-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-1">
              Quick Filter Focus
            </label>
            <div className="relative flex items-center">
              <Input
                id="admin-filter-bar-search"
                placeholder="Press Ctrl+K or / to focus filter bar..."
                className="w-full text-xs h-8 pr-16"
              />
              <span className="absolute right-2 text-[10px] text-muted font-mono select-none pointer-events-none">
                <Kbd>Ctrl+K</Kbd>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Active Filter Badges Row */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-separator select-none">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider mr-1">Active:</span>

          {filters.timeRange !== '24h' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>Time: {filters.timeRange}</Chip.Label>
              <CloseButton onPress={() => setFilter('timeRange', '24h')} />
            </Chip>
          )}

          {filters.environment !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>Env: {filters.environment}</Chip.Label>
              <CloseButton onPress={() => setFilter('environment', 'all')} />
            </Chip>
          )}

          {filters.aiProvider !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>AI: {filters.aiProvider}</Chip.Label>
              <CloseButton onPress={() => setFilter('aiProvider', 'all')} />
            </Chip>
          )}

          {filters.status !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>Status: {filters.status}</Chip.Label>
              <CloseButton onPress={() => setFilter('status', 'all')} />
            </Chip>
          )}

          {filters.organizationId !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>Org: {filters.organizationId}</Chip.Label>
              <CloseButton onPress={() => setFilter('organizationId', 'all')} />
            </Chip>
          )}

          {filters.region !== 'all' && (
            <Chip size="sm" variant="soft" color="accent" className="text-[11px] font-semibold h-5">
              <Chip.Label>Region: {filters.region}</Chip.Label>
              <CloseButton onPress={() => setFilter('region', 'all')} />
            </Chip>
          )}

          <Button
            size="sm"
            variant="ghost"
            onPress={resetFilters}
            className="text-[11px] font-bold text-danger hover:underline h-5 px-1 min-w-0"
          >
            Clear All
          </Button>
        </div>
      )}
    </Card>
  );
}
