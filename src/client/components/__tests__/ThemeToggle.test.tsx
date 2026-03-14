import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import ThemeToggle from '../ThemeToggle';
import { ThemeProvider } from '../../hooks/useTheme';

const renderWithThemeProvider = (component: React.ReactElement) => {
  return render(<ThemeProvider>{component}</ThemeProvider>);
};

describe('ThemeToggle', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render theme toggle button', () => {
    renderWithThemeProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
  });

  it('should show moon icon in light mode', () => {
    // Mock localStorage to return light theme
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderWithThemeProvider(<ThemeToggle />);
    
    // The moon icon should be present in light mode
    const moonIcon = screen.getByLabelText('Switch to dark mode');
    expect(moonIcon).toBeInTheDocument();
  });

  it('should show sun icon in dark mode', () => {
    // Mock localStorage to return dark theme
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('dark'),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderWithThemeProvider(<ThemeToggle />);
    
    // The sun icon should be present in dark mode
    const sunIcon = screen.getByLabelText('Switch to light mode');
    expect(sunIcon).toBeInTheDocument();
  });

  it('should toggle theme when clicked', () => {
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderWithThemeProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByRole('button');
    fireEvent.click(toggleButton);
    
    // After clicking, the theme should have toggled
    expect(localStorageMock.setItem).toHaveBeenCalledWith('alphaarena-theme', 'dark');
  });

  it('should support compact mode', () => {
    renderWithThemeProvider(<ThemeToggle compact />);
    
    const toggleButton = screen.getByRole('button');
    expect(toggleButton).toBeInTheDocument();
    expect(toggleButton).toHaveStyle('padding: 4px');
  });

  it('should have tooltip with correct text in light mode', () => {
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue(null),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderWithThemeProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByLabelText('Switch to dark mode');
    expect(toggleButton).toHaveAttribute('aria-label', 'Switch to dark mode');
  });

  it('should have tooltip with correct text in dark mode', () => {
    const localStorageMock = {
      getItem: jest.fn().mockReturnValue('dark'),
      setItem: jest.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: localStorageMock });

    renderWithThemeProvider(<ThemeToggle />);
    
    const toggleButton = screen.getByLabelText('Switch to light mode');
    expect(toggleButton).toHaveAttribute('aria-label', 'Switch to light mode');
  });
});
