import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../ThemeToggle';
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

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render theme toggle button', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should show moon icon in light mode', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    // The moon icon should be present in light mode
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton.getAttribute('aria-label')).toContain('浅色模式');
  });

  it('should toggle theme when clicked', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    fireEvent.click(toggleButton);
    
    // After clicking, the theme should have toggled
    expect(localStorageMock.setItem).toHaveBeenCalled();
  });

  it('should support compact mode', () => {
    renderWithSettingsProvider(<ThemeToggle compact />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveStyle('padding: 4px');
  });

  it('should have accessible aria-label with current theme state', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    const ariaLabel = toggleButton.getAttribute('aria-label');
    expect(ariaLabel).toContain('主题切换');
    expect(ariaLabel).toContain('当前');
    expect(ariaLabel).toContain('点击切换');
  });

  it('should have aria-pressed attribute indicating current state', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toHaveAttribute('aria-pressed');
  });

  it('should have role="switch" for accessibility', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton).toBeInTheDocument();
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

  it('should be focusable', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    toggleButton.focus();
    expect(toggleButton).toHaveFocus();
  });

  it('should be a button element (keyboard accessible by default)', () => {
    renderWithSettingsProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('switch');
    expect(toggleButton.tagName.toLowerCase()).toBe('button');
  });
});
