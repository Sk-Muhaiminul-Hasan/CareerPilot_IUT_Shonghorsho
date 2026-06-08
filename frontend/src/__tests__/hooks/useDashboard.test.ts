import { describe, it, expect, vi } from 'vitest';

import { DASHBOARD_KEY, GOALS_KEY, CALENDAR_KEY, WEEKLY_PROGRESS_KEY } from '../../hooks/useDashboard';

describe('useDashboard query keys', () => {
  it('DASHBOARD_KEY is ', () => {
    expect(DASHBOARD_KEY).toEqual(['dashboard']);
  });

  it('GOALS_KEY is the goals subkey', () => {
    expect(GOALS_KEY).toEqual(['dashboard', 'goals']);
  });

  it('CALENDAR_KEY is the calendar subkey', () => {
    expect(CALENDAR_KEY).toEqual(['dashboard', 'calendar']);
  });

  it('WEEKLY_PROGRESS_KEY is the weekly-progress subkey', () => {
    expect(WEEKLY_PROGRESS_KEY).toEqual(['dashboard', 'weekly-progress']);
  });

  it('query keys do not use the stale events key', () => {
    expect(CALENDAR_KEY).not.toEqual(['dashboard', 'events']);
    expect(GOALS_KEY).not.toEqual(['dashboard', 'goals', 'events']);
  });
});

import { toDateStringFromBackend, toLocalMidnight } from '../../services/dashboardService';

describe('dashboardService date handling', () => {
  it('formats a backend event_date to YYYY-MM-DD using local calendar', () => {
    const dateStr = toDateStringFromBackend('2026-06-15T10:00:00Z');
    expect(dateStr).toBe('2026-06-15');
  });

  it('formats a date-only backend event_date without timezone shift', () => {
    const dateStr = toDateStringFromBackend('2026-01-01');
    expect(dateStr).toBe('2026-01-01');
  });

  it('returns empty string when backend event_date is null', () => {
    expect(toDateStringFromBackend(null)).toBe('');
  });

  it('returns empty string when backend event_date is undefined', () => {
    expect(toDateStringFromBackend(undefined)).toBe('');
  });
});

describe('dashboardService local midnight serialization', () => {
  it('serializes a Date as a local midnight ISO string preserving local date', () => {
    const date = new Date(2026, 5, 15, 9, 30); // June 15 2026, local
    const serialized = toLocalMidnight(date);
    expect(serialized).toBe('2026-06-15T09:30:00');
  });
});
