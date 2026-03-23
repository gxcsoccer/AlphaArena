/**
 * Tests for EmptyStateIllustration Component
 * 
 * Issue #572: Brand Visual Elements
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { EmptyStateIllustration } from '../EmptyState';
import type { EmptyStateType } from '../EmptyState';

describe('EmptyStateIllustration Component', () => {
  const emptyStateTypes: EmptyStateType[] = [
    'no-trades',
    'no-holdings',
    'no-strategies',
    'no-notifications',
    'no-results',
    'no-data',
    'no-portfolio',
    'no-orders',
  ];

  describe.each(emptyStateTypes)('Type: %s', (type) => {
    it(`renders ${type} illustration correctly`, () => {
      const { container } = render(<EmptyStateIllustration type={type} />);
      const svg = container.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it(`has correct aria-label for ${type}`, () => {
      const { container } = render(<EmptyStateIllustration type={type} />);
      const wrapper = container.querySelector('.empty-state-illustration');
      expect(wrapper).toHaveAttribute('aria-label', `${type} illustration`);
    });
  });

  describe('Size Variants', () => {
    it('renders sm size correctly', () => {
      const { container } = render(
        <EmptyStateIllustration type="no-data" size="sm" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '120');
      expect(svg).toHaveAttribute('height', '120');
    });

    it('renders md size correctly', () => {
      const { container } = render(
        <EmptyStateIllustration type="no-data" size="md" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '200');
      expect(svg).toHaveAttribute('height', '200');
    });

    it('renders lg size correctly', () => {
      const { container } = render(
        <EmptyStateIllustration type="no-data" size="lg" />
      );
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '280');
      expect(svg).toHaveAttribute('height', '280');
    });
  });

  describe('Styling', () => {
    it('applies custom className', () => {
      const { container } = render(
        <EmptyStateIllustration type="no-data" className="custom-class" />
      );
      const wrapper = container.querySelector('.empty-state-illustration');
      expect(wrapper).toHaveClass('custom-class');
    });

    it('applies custom style', () => {
      const { container } = render(
        <EmptyStateIllustration type="no-data" style={{ margin: '10px' }} />
      );
      const wrapper = container.querySelector('.empty-state-illustration');
      expect(wrapper).toHaveStyle({ margin: '10px' });
    });
  });

  describe('Accessibility', () => {
    it('has correct role attribute', () => {
      const { container } = render(<EmptyStateIllustration type="no-data" />);
      const wrapper = container.querySelector('.empty-state-illustration');
      expect(wrapper).toHaveAttribute('role', 'img');
    });
  });
});