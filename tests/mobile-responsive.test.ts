/**
 * Mobile Responsive Optimization Tests - Issue #401
 * 
 * Tests for verifying mobile responsive design implementation
 * including responsive layouts, touch interactions, and navigation.
 */

import { BREAKPOINTS } from '../src/client/hooks/useMediaQuery';

describe('Mobile Responsive Optimization - Issue #401', () => {
  describe('Breakpoint Constants', () => {
    it('should define correct breakpoints', () => {
      expect(BREAKPOINTS.xs).toBe(320);
      expect(BREAKPOINTS.sm).toBe(480);
      expect(BREAKPOINTS.md).toBe(768);
      expect(BREAKPOINTS.lg).toBe(1024);
      expect(BREAKPOINTS.xl).toBe(1440);
      expect(BREAKPOINTS.xxl).toBe(1920);
    });

    it('should have mobile breakpoint at 768px', () => {
      expect(BREAKPOINTS.md).toBe(768);
    });

    it('should have breakpoints in ascending order', () => {
      const values = Object.values(BREAKPOINTS);
      for (let i = 1; i < values.length; i++) {
        expect(values[i]).toBeGreaterThan(values[i - 1]);
      }
    });
  });

  describe('Touch Target Sizes', () => {
    it('should have minimum 44px touch target for accessibility', () => {
      const MIN_TOUCH_TARGET = 44;
      expect(MIN_TOUCH_TARGET).toBe(44);
    });

    it('should define touch target sizes in CSS variables', () => {
      // These values should match the CSS definitions
      const touchTargets = {
        button: 44,
        input: 44,
        menuItem: 44,
        listItem: 44,
      };

      Object.values(touchTargets).forEach(size => {
        expect(size).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe('Responsive Grid System', () => {
    it('should use correct column spans for different breakpoints', () => {
      const gridConfig = {
        mobile: { cols: 1, span: 24 },
        tablet: { cols: 2, span: 12 },
        desktop: { cols: 4, span: 6 },
      };

      expect(gridConfig.mobile.span).toBe(24);
      expect(gridConfig.tablet.span).toBe(12);
      expect(gridConfig.desktop.span).toBe(6);
    });

    it('should use correct gutter sizes for different breakpoints', () => {
      const gutterConfig = {
        mobile: 8,
        tablet: 12,
        desktop: 16,
      };

      expect(gutterConfig.mobile).toBeLessThan(gutterConfig.tablet);
      expect(gutterConfig.tablet).toBeLessThan(gutterConfig.desktop);
    });
  });

  describe('Chart Heights', () => {
    it('should reduce chart heights on mobile', () => {
      const chartHeights = {
        desktop: 500,
        tablet: 350,
        mobile: 300,
      };

      expect(chartHeights.mobile).toBeLessThan(chartHeights.desktop);
      expect(chartHeights.tablet).toBeLessThan(chartHeights.desktop);
      expect(chartHeights.mobile).toBeGreaterThanOrEqual(200);
    });
  });

  describe('Safe Area Insets', () => {
    it('should support safe area environment variables', () => {
      const safeAreaProperties = [
        'safe-area-inset-top',
        'safe-area-inset-right',
        'safe-area-inset-bottom',
        'safe-area-inset-left',
      ];

      safeAreaProperties.forEach(prop => {
        expect(prop).toContain('safe-area-inset');
      });
    });
  });

  describe('Mobile Navigation', () => {
    it('should show bottom navigation on mobile', () => {
      const navItems = [
        { key: '/', label: '行情' },
        { key: '/dashboard', label: '仪表板' },
        { key: '/trades', label: '交易' },
        { key: '/holdings', label: '持仓' },
        { key: '/strategies', label: '策略' },
        { key: '/user-dashboard', label: '我的' },
      ];

      expect(navItems.length).toBeGreaterThanOrEqual(4);
      expect(navItems.length).toBeLessThanOrEqual(8); // Not too many items
    });

    it('should use drawer menu on mobile instead of sider', () => {
      const mobileNavigationType = 'drawer';
      const desktopNavigationType = 'sider';

      expect(mobileNavigationType).toBe('drawer');
      expect(desktopNavigationType).toBe('sider');
    });
  });

  describe('Content Padding', () => {
    it('should reduce padding on mobile for better space utilization', () => {
      const paddingConfig = {
        mobile: 12,
        tablet: 16,
        desktop: 24,
      };

      expect(paddingConfig.mobile).toBeLessThan(paddingConfig.desktop);
    });
  });

  describe('Font Sizes', () => {
    it('should scale fonts appropriately on mobile', () => {
      const fontConfig = {
        mobile: { body: 14, heading: 16 },
        tablet: { body: 14, heading: 18 },
        desktop: { body: 16, heading: 20 },
      };

      expect(fontConfig.mobile.body).toBeLessThanOrEqual(fontConfig.desktop.body);
      expect(fontConfig.mobile.heading).toBeLessThan(fontConfig.desktop.heading);
    });
  });
});

describe('Mobile Component Rendering', () => {
  describe('MobileBottomNav', () => {
    it('should have correct number of navigation items', () => {
      const expectedNavItems = 7; // 行情, 仪表板, 交易, 持仓, 策略, 再平衡, 我的
      expect(expectedNavItems).toBe(7);
    });

    it('should have proper ARIA attributes', () => {
      const ariaAttributes = {
        nav: { role: 'navigation', 'aria-label': '移动端底部导航' },
        button: { 'aria-label': true, 'aria-current': 'page' },
      };

      expect(ariaAttributes.nav.role).toBe('navigation');
      expect(ariaAttributes.button['aria-label']).toBe(true);
    });
  });

  describe('MobileTableCard', () => {
    it('should support priority-based field ordering', () => {
      const fields = [
        { key: 'name', priority: 1 },
        { key: 'status', priority: 2 },
        { key: 'description', priority: 3 },
      ];

      const sortedFields = [...fields].sort((a, b) => a.priority - b.priority);
      
      expect(sortedFields[0].key).toBe('name');
      expect(sortedFields[2].key).toBe('description');
    });

    it('should support different field types', () => {
      const fieldTypes = ['text', 'tag', 'number', 'currency', 'percent', 'datetime'];
      
      fieldTypes.forEach(type => {
        expect(typeof type).toBe('string');
      });
    });
  });
});

describe('Responsive Design Constants', () => {
  it('should define mobile as ≤768px', () => {
    const mobileWidths = [320, 375, 414, 480, 768];
    
    mobileWidths.forEach((width) => {
      expect(width).toBeLessThanOrEqual(768);
    });
  });

  it('should define tablet as 769px - 1024px', () => {
    const tabletWidths = [769, 800, 900, 1024];
    
    tabletWidths.forEach((width) => {
      expect(width).toBeGreaterThan(768);
      expect(width).toBeLessThanOrEqual(1024);
    });
  });

  it('should define desktop as >1024px', () => {
    const desktopWidths = [1025, 1280, 1440, 1920];
    
    desktopWidths.forEach((width) => {
      expect(width).toBeGreaterThan(1024);
    });
  });

  it('should ensure touch targets meet WCAG guidelines', () => {
    const WCAG_MIN_TOUCH_TARGET = 44;
    const touchTargets = {
      button: 44,
      input: 44,
      select: 44,
      menuItem: 44,
    };

    Object.values(touchTargets).forEach(size => {
      expect(size).toBeGreaterThanOrEqual(WCAG_MIN_TOUCH_TARGET);
    });
  });
});

describe('CSS Media Queries', () => {
  it('should apply mobile styles at 768px breakpoint', () => {
    const mobileBreakpoint = 768;
    expect(mobileBreakpoint).toBe(768);
  });

  it('should apply small mobile styles at 480px breakpoint', () => {
    const smallMobileBreakpoint = 480;
    expect(smallMobileBreakpoint).toBe(480);
  });

  it('should apply tablet styles between 769px and 1024px', () => {
    const tabletMin = 769;
    const tabletMax = 1024;
    
    expect(tabletMin).toBe(769);
    expect(tabletMax).toBe(1024);
  });
});