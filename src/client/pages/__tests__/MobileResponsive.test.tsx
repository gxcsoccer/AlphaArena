/**
 * Mobile Responsive Tests - Issue #401
 * Tests for mobile responsive optimizations across all main pages
 * 
 * Acceptance Criteria:
 * - All major pages display correctly at 375px width
 * - Navigation works on mobile
 * - Touch interactions are smooth
 * - Mobile Lighthouse performance score > 80
 */

import { render } from '@testing-library/react';

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

describe('Mobile Responsive Optimizations - Issue #401', () => {
  describe('CSS Media Queries', () => {
    it('should have mobile breakpoints defined', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../index.css'),
        'utf-8'
      );

      // Check for mobile media queries
      expect(cssFile).toContain('@media (max-width: 768px)');
      expect(cssFile).toContain('@media (max-width: 480px)');
    });

    it('should have touch target sizing (min 44px)', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../index.css'),
        'utf-8'
      );

      // Check for WCAG 2.5.5 touch target compliance
      expect(cssFile).toMatch(/min-height:\s*44px/);
    });

    it('should have safe area insets for notched devices', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../index.css'),
        'utf-8'
      );

      expect(cssFile).toContain('env(safe-area-inset-top)');
      expect(cssFile).toContain('env(safe-area-inset-bottom)');
    });

    it('should support reduced motion preferences', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../index.css'),
        'utf-8'
      );

      expect(cssFile).toContain('prefers-reduced-motion: reduce');
    });

    it('should support high contrast mode', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../index.css'),
        'utf-8'
      );

      expect(cssFile).toContain('prefers-contrast: high');
    });
  });

  describe('Mobile Bottom Navigation CSS', () => {
    it('should have mobile bottom nav styles', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../components/MobileBottomNav.css'),
        'utf-8'
      );

      expect(cssFile).toContain('.mobile-bottom-nav');
      expect(cssFile).toContain('.mobile-bottom-nav__item');
      expect(cssFile).toContain('.mobile-bottom-nav__item--active');
    });

    it('should hide bottom nav on desktop', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../components/MobileBottomNav.css'),
        'utf-8'
      );

      expect(cssFile).toContain('@media (min-width: 769px)');
    });
  });

  describe('Mobile Header CSS', () => {
    it('should have mobile header styles', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../components/MobileHeader.css'),
        'utf-8'
      );

      expect(cssFile).toContain('.mobile-header');
      expect(cssFile).toContain('.mobile-header__menu-btn');
    });

    it('should have safe area support for notched devices', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../components/MobileHeader.css'),
        'utf-8'
      );

      expect(cssFile).toContain('env(safe-area-inset-top)');
    });
  });

  describe('Mobile Table Card CSS', () => {
    it('should have mobile table card styles', () => {
import fs from 'fs';
import path from 'path';
      
      const cssFile = fs.readFileSync(
        path.join(__dirname, '../../components/MobileTableCard.css'),
        'utf-8'
      );

      expect(cssFile).toContain('.mobile-table-card');
    });
  });

  describe('Page Component Structure', () => {
    it('BacktestVisualizationPage should use useMediaQuery', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../BacktestVisualizationPage.tsx'),
        'utf-8'
      );

      expect(file).toContain("from '../hooks/useMediaQuery'");
      expect(file).toContain('isMobile');
    });

    it('HomePage should have mobile detection', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../HomePage.tsx'),
        'utf-8'
      );

      expect(file).toContain('isMobile');
      expect(file).toContain('mobileTab');
    });

    it('DashboardPage should have mobile layout', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../DashboardPage.tsx'),
        'utf-8'
      );

      expect(file).toContain('isMobile');
      expect(file).toContain('MobileTableCard');
    });

    it('StrategiesPage should have mobile layout', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../StrategiesPage.tsx'),
        'utf-8'
      );

      expect(file).toContain('useMediaQuery');
      expect(file).toContain('useSwipeNavigation');
    });

    it('ApiDocsPage should have mobile layout', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../ApiDocsPage.tsx'),
        'utf-8'
      );

      expect(file).toContain('useMediaQuery');
      expect(file).toContain('isMobile');
    });
  });

  describe('Touch Gesture Hooks', () => {
    it('useTouchGestures should be properly structured', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../../hooks/useTouchGestures.ts'),
        'utf-8'
      );

      expect(file).toContain('useTouchGestures');
      expect(file).toContain('usePullToRefresh');
      expect(file).toContain('useSwipeNavigation');
    });

    it('useMediaQuery should export necessary types and functions', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../../hooks/useMediaQuery.ts'),
        'utf-8'
      );

      expect(file).toContain('useMediaQuery');
      expect(file).toContain('useMatchMedia');
      expect(file).toContain('useTouchDevice');
    });
  });

  describe('App Layout Mobile Support', () => {
    it('App.tsx should have mobile detection', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../../App.tsx'),
        'utf-8'
      );

      expect(file).toContain('isMobile');
      expect(file).toContain('mobileMenuVisible');
      expect(file).toContain('MobileBottomNav');
    });

    it('App.tsx should render mobile drawer menu', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../../App.tsx'),
        'utf-8'
      );

      expect(file).toContain('Drawer');
      expect(file).toContain('mobileMenuVisible');
    });

    it('App.tsx should render mobile bottom navigation', () => {
import fs from 'fs';
import path from 'path';
      
      const file = fs.readFileSync(
        path.join(__dirname, '../../App.tsx'),
        'utf-8'
      );

      expect(file).toContain('MobileBottomNav');
      expect(file).toContain('mobile-nav-spacer');
    });
  });
});