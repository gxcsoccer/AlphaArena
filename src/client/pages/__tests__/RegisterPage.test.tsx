/**
 * Tests for RegisterPage
 * Issue #733: P0 - Registration flow broken - form submission fails
 */

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../RegisterPage';
import * as useAuthModule from '../../hooks/useAuth';

// Mock useNavigate
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useSearchParams: () => [new URLSearchParams()],
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

// Mock useSEO
jest.mock('../../hooks/useSEO', () => ({
  useSEO: jest.fn(),
  PAGE_SEO_CONFIGS: {
    register: {},
  },
}));

// Mock i18next
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'register.title': 'Create Account',
        'register.subtitle': 'Sign up to get started',
        'register.email': 'Email',
        'register.username': 'Username',
        'register.password': 'Password',
        'register.confirmPassword': 'Confirm Password',
        'register.submit': 'Create Account',
        'register.passwordRequirements.title': 'Password Requirements',
        'register.passwordRequirements.minLength': 'At least 8 characters',
        'register.passwordRequirements.uppercase': 'At least one uppercase letter',
        'register.passwordRequirements.lowercase': 'At least one lowercase letter',
        'register.passwordRequirements.number': 'At least one number',
        'register.passwordMismatch': 'Passwords do not match',
        'register.error': 'Registration failed',
        'register.hasAccount': 'Already have an account?',
        'register.login': 'Login',
      };
      return translations[key] || key;
    },
  }),
}));

// Mock fetch for referral validation
global.fetch = jest.fn().mockResolvedValue({
  json: () => Promise.resolve({ success: true, data: { valid: true } }),
});

// Mock Logo component
jest.mock('../../components/brand/Logo', () => ({
  Logo: () => <div data-testid="logo">AlphaArena</div>,
}));

// Create a mock register function that can be controlled in tests
const mockRegister = jest.fn().mockResolvedValue(undefined);

// Mock the useAuth module
jest.mock('../../hooks/useAuth', () => ({
  useAuth: () => ({
    register: mockRegister,
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    isLoading: false,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRegister.mockResolvedValue(undefined);
  });

  it('should render the registration form', () => {
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Create Account')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter your email')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Choose a username')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Create a password')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Confirm your password')).toBeInTheDocument();
  });

  it('should track password input values correctly', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Find password input
    const passwordInput = screen.getByPlaceholderText('Create a password');
    
    // Type password that meets all requirements
    await user.type(passwordInput, 'Password123');

    // Wait for password validation to update
    await waitFor(() => {
      // The submit button should be enabled when password meets requirements
      const submitButton = screen.getByRole('button', { name: 'Create Account' });
      // Button should still be disabled because confirmPassword is not filled
      // But it should NOT be disabled due to password validation failing
      expect(submitButton).toBeDisabled(); // Disabled because confirmPassword not filled
    });

    // Fill confirm password to enable the button
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    // Now button should be enabled (if email is also filled)
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: 'Create Account' });
      // Still disabled because email not filled
      expect(submitButton).toBeDisabled();
    });
  });

  it('should enable submit button when all validations pass', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill email
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');

    // Fill password
    const passwordInput = screen.getByPlaceholderText('Create a password');
    await user.type(passwordInput, 'Password123');

    // Fill confirm password
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    // Wait for validations
    await waitFor(() => {
      const submitButton = screen.getByRole('button', { name: 'Create Account' });
      expect(submitButton).not.toBeDisabled();
    });
  });

  it('should call register with correct data when form is submitted', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill email
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');

    // Fill password
    const passwordInput = screen.getByPlaceholderText('Create a password');
    await user.type(passwordInput, 'Password123');

    // Fill confirm password
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    // Submit form
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    
    await act(async () => {
      await user.click(submitButton);
    });

    // Wait for register to be called
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        username: undefined,
        password: 'Password123',
        ref: undefined,
      });
    });
  });

  it('should navigate to dashboard after successful registration', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill and submit form
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');

    const passwordInput = screen.getByPlaceholderText('Create a password');
    await user.type(passwordInput, 'Password123');

    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    
    await act(async () => {
      await user.click(submitButton);
    });

    // Wait for navigation
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should display error message when registration fails', async () => {
    mockRegister.mockRejectedValue(new Error('Email already registered'));
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill and submit form
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');

    const passwordInput = screen.getByPlaceholderText('Create a password');
    await user.type(passwordInput, 'Password123');

    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    
    await act(async () => {
      await user.click(submitButton);
    });

    // Wait for error message
    await waitFor(() => {
      expect(screen.getByText('Email already registered')).toBeInTheDocument();
    });
  });

  // Issue #733 specific test: Ensure password value is tracked by Arco Design Form
  it('should not have undefined password value when form is submitted', async () => {
    // This test catches the bug where password input used independent React state
    // instead of Arco Design Form control, causing values.password to be undefined

    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>
    );

    // Fill password first
    const passwordInput = screen.getByPlaceholderText('Create a password');
    await user.type(passwordInput, 'Password123');

    // Fill confirm password
    const confirmPasswordInput = screen.getByPlaceholderText('Confirm your password');
    await user.type(confirmPasswordInput, 'Password123');

    // Fill email
    const emailInput = screen.getByPlaceholderText('Enter your email');
    await user.type(emailInput, 'test@example.com');

    // Submit
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    await waitFor(() => expect(submitButton).not.toBeDisabled());
    
    await act(async () => {
      await user.click(submitButton);
    });

    // Verify password was passed correctly (not undefined)
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalled();
      const callArgs = mockRegister.mock.calls[0][0];
      expect(callArgs.password).toBe('Password123');
      expect(callArgs.password).not.toBeUndefined();
    });
  });
});