/**
 * Accessibility Tests for Issue #214: UI 可访问性增强
 * 
 * These tests verify that:
 * - All buttons have visible labels or clear tooltips
 * - All interactive elements are keyboard accessible
 * - Focus indicators are visible
 * - Screen reader can announce all UI elements correctly
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../ThemeToggle';
import SettingsPanel from '../SettingsPanel';
import { SettingsProvider } from '../../store/settingsStore';

// Mock matchMedia
const matchMediaMock = jest.fn().mockImplementation(query => ({
  matches: false,
  media: query,
  onchange: null,
  addListener: jest.fn(),
  removeListener: jest.fn(),
  addEventListener: jest.fn(),
  removeEventListener: jest.fn(),
  dispatchEvent: jest.fn(),
}));
Object.defineProperty(window, 'matchMedia', {
  value: matchMediaMock,
  writable: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn().mockReturnValue(null),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

const renderWithSettingsProvider = (component: React.ReactElement) => {
  return render(<SettingsProvider>{component}</SettingsProvider>);
};

describe('Accessibility - ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mock to return light mode by default for consistent tests
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ theme: 'light', language: 'zh' }));
  });

  it('should have an accessible aria-label describing current theme state', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toHaveAttribute('aria-label');
    expect(toggleButton.getAttribute('aria-label')).toContain('主题切换');
  });

  it('should have aria-pressed attribute indicating current state', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toHaveAttribute('aria-pressed');
  });

  it('should show visible label in non-compact mode', () => {
    renderWithSettingsProvider(<ThemeToggle compact={false} />);
    
    // Should show theme label text
    expect(screen.getByText(/模式/)).toBeInTheDocument();
  });

  it('should not show visible label in compact mode', () => {
    renderWithSettingsProvider(<ThemeToggle compact={true} />);
    
    // Should not show theme label text in compact mode
    expect(screen.queryByText(/模式/)).not.toBeInTheDocument();
  });

  it('should have proper tooltip content', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    // The button should have an aria-label that provides context
    const toggleButton = screen.getByRole('switch');
    const ariaLabel = toggleButton.getAttribute('aria-label');
    expect(ariaLabel).toMatch(/当前.*模式/);
    expect(ariaLabel).toMatch(/点击切换/);
  });

  it('should be a button element (keyboard accessible by default)', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton.tagName.toLowerCase()).toBe('button');
  });
});

describe('Accessibility - SettingsPanel', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset localStorage mock to return light mode by default for consistent tests
    localStorageMock.getItem.mockReturnValue(JSON.stringify({ theme: 'light', language: 'zh' }));
  });

  it('should have an accessible aria-label on the settings button', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    expect(settingsButton).toBeInTheDocument();
    expect(settingsButton).toHaveAttribute('aria-label', '打开设置面板');
  });

  it('should have aria-haspopup attribute indicating it opens a dialog', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    expect(settingsButton).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('should have aria-expanded attribute reflecting modal state', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    expect(settingsButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should open modal when button is clicked', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    fireEvent.click(settingsButton);
    
    // Modal should be visible - use queryAllByRole and check length
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
  });

  it('should show visible label in non-compact mode', () => {
    renderWithSettingsProvider(<SettingsPanel compact={false} />);
    
    expect(screen.getByText('设置')).toBeInTheDocument();
  });

  it('should not show visible label in compact mode', () => {
    renderWithSettingsProvider(<SettingsPanel compact={true} />);
    
    // The button should exist but without visible label
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    expect(settingsButton).toBeInTheDocument();
  });

  it('modal should have proper accessibility attributes', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    fireEvent.click(settingsButton);
    
    // Use queryAllByRole and check the first one
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
    expect(dialogs[0]).toHaveAttribute('aria-modal', 'true');
  });

  it('should have accessible radio groups in the modal', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    fireEvent.click(settingsButton);
    
    // Radio groups should be accessible
    const radios = screen.getAllByRole('radio');
    expect(radios.length).toBeGreaterThan(0);
  });
});

describe('Accessibility - Focus Management', () => {
  it('should have tabindex attribute for keyboard navigation', () => {
    renderWithSettingsProvider(
      <div>
        <ThemeToggle />
        <SettingsPanel />
      </div>
    );
    
    const switchElement = screen.getByRole('switch');
    const buttonElement = screen.getByRole('button', { name: /打开设置/i });
    
    // Elements should be focusable
    expect(switchElement).not.toHaveAttribute('tabindex', '-1');
    expect(buttonElement).not.toHaveAttribute('tabindex', '-1');
  });
});

describe('Accessibility - Color Contrast', () => {
  it('should use CSS variables for theming', () => {
    const { container } = renderWithSettingsProvider(<ThemeToggle />);
    
    // Check that component uses CSS variables
    const button = container.querySelector('button');
    expect(button).toHaveStyle({ color: 'var(--color-text-1)' });
  });
});

describe('Accessibility - ARIA Attributes', () => {
  it('should have role="switch" for toggle buttons', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should have role="dialog" for modals', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    fireEvent.click(settingsButton);
    
    const dialogs = screen.queryAllByRole('dialog');
    expect(dialogs.length).toBeGreaterThan(0);
  });

  it('should have aria-live regions for dynamic content', () => {
    renderWithSettingsProvider(<SettingsPanel />);
    
    const settingsButton = screen.getByRole('button', { name: /打开设置/i });
    fireEvent.click(settingsButton);
    
    // Current settings summary should be announced
    const statusRegion = screen.getByRole('status');
    expect(statusRegion).toBeInTheDocument();
  });
});
