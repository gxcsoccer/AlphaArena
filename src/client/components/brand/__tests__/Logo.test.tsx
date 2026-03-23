/**
 * Tests for Logo Component
 * 
 * Issue #572: Brand Visual Elements
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Logo, LogoIcon, HeaderLogo } from '../Logo';

describe('Logo Component', () => {
  describe('Basic Rendering', () => {
    it('renders with wordmark by default', () => {
      render(<Logo />);
      expect(screen.getByText('AlphaArena')).toBeInTheDocument();
    });

    it('renders without wordmark when showWordmark is false', () => {
      render(<Logo showWordmark={false} />);
      expect(screen.queryByText('AlphaArena')).not.toBeInTheDocument();
    });

    it('renders as SVG icon', () => {
      const { container } = render(<Logo showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Size Variants', () => {
    it('renders xs size correctly', () => {
      const { container } = render(<Logo size="xs" showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '24');
    });

    it('renders sm size correctly', () => {
      const { container } = render(<Logo size="sm" showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '32');
    });

    it('renders md size correctly', () => {
      const { container } = render(<Logo size="md" showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '40');
    });

    it('renders lg size correctly', () => {
      const { container } = render(<Logo size="lg" showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '48');
    });

    it('renders xl size correctly', () => {
      const { container } = render(<Logo size="xl" showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '64');
    });
  });

  describe('Color Themes', () => {
    it('renders with primary color', () => {
      const { container } = render(<Logo color="primary" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with light color', () => {
      const { container } = render(<Logo color="light" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with dark color', () => {
      const { container } = render(<Logo color="dark" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders with auto color', () => {
      const { container } = render(<Logo color="auto" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('adds animated class when animated is true', () => {
      const { container } = render(<Logo animated />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('animated');
    });

    it('does not add animated class when animated is false', () => {
      const { container } = render(<Logo animated={false} />);
      const svg = container.querySelector('svg');
      expect(svg).not.toHaveClass('animated');
    });
  });

  describe('Interaction', () => {
    it('calls onClick when clicked', () => {
      const handleClick = jest.fn();
      const { container } = render(<Logo onClick={handleClick} showWordmark={false} />);
      const svg = container.querySelector('svg');
      fireEvent.click(svg!);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Accessibility', () => {
    it('has correct role attribute', () => {
      const { container } = render(<Logo showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('role', 'img');
    });

    it('has correct aria-label', () => {
      const { container } = render(<Logo showWordmark={false} />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('aria-label', 'AlphaArena Logo');
    });
  });
});

describe('LogoIcon Component', () => {
  it('renders without wordmark', () => {
    render(<LogoIcon />);
    expect(screen.queryByText('AlphaArena')).not.toBeInTheDocument();
  });

  it('passes size prop correctly', () => {
    const { container } = render(<LogoIcon size="lg" />);
    const svg = container.querySelector('svg');
    expect(svg).toHaveAttribute('width', '48');
  });
});

describe('HeaderLogo Component', () => {
  it('renders with wordmark when not collapsed', () => {
    render(<HeaderLogo collapsed={false} />);
    expect(screen.getByText('AlphaArena')).toBeInTheDocument();
  });

  it('renders without wordmark when collapsed', () => {
    render(<HeaderLogo collapsed={true} />);
    expect(screen.queryByText('AlphaArena')).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<HeaderLogo onClick={handleClick} />);
    fireEvent.click(screen.getByText('AlphaArena'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});