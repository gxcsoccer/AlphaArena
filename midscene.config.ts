import { defineConfig } from '@midscene/core';

export default defineConfig({
  test: [
    {
      name: 'Sprint 1 UI Acceptance Tests',
      tests: [
        {
          name: 'Strategies Page - Default Single Strategy Selection',
          url: 'http://localhost:3000/strategies',
          actions: [
            'Wait for page to load',
            'Verify that exactly one strategy is selected by default',
            'Verify that the selected strategy shows independent data',
            'Take screenshot of strategies page',
          ],
        },
        {
          name: 'Dashboard Page - Layout and Interactions',
          url: 'http://localhost:3000/dashboard',
          actions: [
            'Wait for page to load',
            'Verify dashboard layout is correct',
            'Verify navigation menu works',
            'Take screenshot of dashboard',
          ],
        },
        {
          name: 'Navigation - Type Safety and Interactions',
          url: 'http://localhost:3000/',
          actions: [
            'Navigate to Strategies page',
            'Navigate to Trades page',
            'Navigate to Holdings page',
            'Navigate to Leaderboard page',
            'Verify all navigation items are clickable',
          ],
        },
      ],
    },
  ],
});
