/**
 * Register Page
 * New user registration form with mobile responsive design
 * Features: Real-time password validation, proper tab order, enhanced focus styles
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Form, Input, Button, Message, Typography, Space, Link, Grid, Tag, Alert } from '@arco-design/web-react';
import { IconUser, IconLock, IconEmail, IconCheck, IconClose, IconGift } from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link as RouterLink, useSearchParams } from 'react-router-dom';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/brand/Logo';
import './RegisterPage.css';

const { Title, Text } = Typography;
const FormItem = Form.Item;
const { _Row, _Col } = Grid;

interface RegisterFormValues {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

interface PasswordValidation {
  hasMinLength: boolean;
  hasUppercase: boolean;
  hasLowercase: boolean;
  hasNumber: boolean;
  isValid: boolean;
}

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation('auth');
  const [searchParams] = useSearchParams();
  const [form] = Form.useForm<RegisterFormValues>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralValid, setReferralValid] = useState<boolean | null>(null);

  // Watch password and confirmPassword values from form
  const password = Form.useWatch('password', form) || '';
  const confirmPassword = Form.useWatch('confirmPassword', form) || '';

  // SEO: Update meta tags for register page
  useSEO(PAGE_SEO_CONFIGS.register);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Check for referral code in URL
  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      setReferralCode(ref);
      // Validate the referral code
      fetch(`/api/referral/validate/${ref}`)
        .then(res => res.json())
        .then(data => {
          setReferralValid(data.success && data.data?.valid);
        })
        .catch(() => {
          setReferralValid(false);
        });
    }
  }, [searchParams]);

  // Real-time password validation
  const passwordValidation: PasswordValidation = useMemo(() => {
    return {
      hasMinLength: password.length >= 8,
      hasUppercase: /[A-Z]/.test(password),
      hasLowercase: /[a-z]/.test(password),
      hasNumber: /[0-9]/.test(password),
      isValid: password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password),
    };
  }, [password]);

  // Check if passwords match
  const passwordsMatch = useMemo(() => {
    if (!confirmPassword) return null;
    return password === confirmPassword;
  }, [password, confirmPassword]);

  const handleSubmit = useCallback(async (values: RegisterFormValues) => {
    // Get current values from form instance to ensure we have latest state
    const currentPassword = values.password || password;
    const currentConfirmPassword = values.confirmPassword || confirmPassword;

    // Check password validation
    if (!passwordValidation.isValid) {
      setError(t('register.passwordRequirements.title'));
      return;
    }

    // Check password confirmation
    if (currentPassword !== currentConfirmPassword) {
      setError(t('register.passwordMismatch'));
      return;
    }

    setLoading(true);
    setError(null);
    setErrors([]);

    try {
      await register({
        email: values.email,
        username: values.username || undefined,
        password: currentPassword,
        ref: referralCode || undefined,
      });
      // Redirect to home page where onboarding elements exist
      // New users should see the trading interface first for the guided onboarding
      navigate('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : t('register.error');
      setError(message);
      
      if ((err as any).details) {
        setErrors((err as any).details);
      }
    } finally {
      setLoading(false);
    }
  }, [password, confirmPassword, passwordValidation, t, register, referralCode, navigate]);

  // Render password requirement item with validation status
  const renderRequirement = (text: string, isValid: boolean) => (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '4px 0',
      transition: 'color 0.2s ease',
    }}>
      {isValid ? (
        <IconCheck style={{ color: 'var(--color-success)', fontSize: '14px' }} />
      ) : (
        <IconClose style={{ color: 'var(--color-text-4)', fontSize: '14px' }} />
      )}
      <Text style={{
        fontSize: '12px',
        color: isValid ? 'var(--color-success)' : 'var(--color-text-3)',
        transition: 'color 0.2s ease',
      }}>
        {text}
      </Text>
    </div>
  );

  return (
    <div style={isMobile ? styles.containerMobile : styles.container}>
      <div style={isMobile ? styles.cardMobile : styles.card}>
        <Space direction="vertical" size={isMobile ? 'medium' : 'large'} style={{ width: '100%' }}>
          <div style={styles.header}>
            <Logo size="lg" showWordmark={true} onClick={() => navigate('/')} />
            <Title heading={isMobile ? 5 : 4} style={{ margin: '16px 0 8px' }}>
              {t('register.title')}
            </Title>
            <Text type="secondary">{t('register.subtitle')}</Text>
          </div>

          {error && (
            <Message type="error">
              {error}
              {errors.length > 0 && (
                <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px' }}>
                  {errors.map((err, idx) => (
                    <li key={idx}>{err}</li>
                  ))}
                </ul>
              )}
            </Message>
          )}

          {/* Referral Bonus Banner */}
          {referralCode && (
            <Alert
              type="success"
              icon={<IconGift />}
              content={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span>🎉 通过邀请链接注册</span>
                  <Tag color="green">获赠 7 天 VIP Pro</Tag>
                </div>
              }
              style={{ marginBottom: 16 }}
            />
          )}

          <Form
            form={form}
            layout="vertical"
            autoComplete="off"
            onSubmit={handleSubmit as any}
            style={{ width: '100%' }}
          >
            <FormItem
              label={t('register.email')}
              field="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                {
                  validator: (value, callback) => {
                    // Trim the email before validation
                    const trimmedEmail = (value || '').trim();
                    // Simple email regex: something@something.something
                    // This is more lenient than the strict RFC regex but catches obvious invalid formats
                    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                    if (!trimmedEmail) {
                      callback('Please enter your email');
                    } else if (!emailRegex.test(trimmedEmail)) {
                      callback('Please enter a valid email address');
                    } else {
                      callback();
                    }
                  },
                },
              ]}
            >
              <Input
                prefix={<IconEmail />}
                placeholder="Enter your email"
                size="large"
                tabIndex={1}
                className="register-form-input"
                style={styles.inputFocus}
              />
            </FormItem>

            <FormItem
              label={t('register.username') + ' (optional)'}
              field="username"
              rules={[
                { minLength: 3, message: 'Username must be at least 3 characters' },
                { maxLength: 50, message: 'Username must be at most 50 characters' },
                {
                  validator: (value, callback) => {
                    if (value && !/^[a-zA-Z0-9_]+$/.test(value)) {
                      callback('Username can only contain letters, numbers, and underscores');
                    } else {
                      callback();
                    }
                  },
                },
              ]}
            >
              <Input
                prefix={<IconUser />}
                placeholder="Choose a username"
                size="large"
                tabIndex={2}
                className="register-form-input"
                style={styles.inputFocus}
              />
            </FormItem>

            <FormItem
              label={t('register.password')}
              field="password"
              required
              rules={[
                { required: true, message: 'Please enter your password' },
                {
                  validator: (value, callback) => {
                    if (value && !passwordValidation.isValid) {
                      callback('Password does not meet all requirements');
                    } else {
                      callback();
                    }
                  },
                },
              ]}
            >
              <Input.Password
                prefix={<IconLock />}
                placeholder="Create a password"
                size="large"
                tabIndex={3}
                onFocus={() => setPasswordFocused(true)}
                onBlur={() => setPasswordFocused(false)}
                autoComplete="new-password"
                className={`register-form-input ${password && !passwordValidation.isValid ? 'error' : ''}`}
                style={{
                  ...styles.inputFocus,
                  ...(password && !passwordValidation.isValid ? styles.inputError : {}),
                }}
              />
            </FormItem>
            {/* Password requirements panel - shows on focus or when there's an error */}
            {(passwordFocused || (password && !passwordValidation.isValid)) && (
              <div style={{ marginTop: '-12px', marginBottom: '16px' }}>
                <div style={styles.passwordRequirements} className="password-requirements-panel">
                  <Text style={{ fontSize: '12px', fontWeight: 500, marginBottom: '8px', display: 'block' }}>
                    {t('register.passwordRequirements.title')}
                  </Text>
                  {renderRequirement(t('register.passwordRequirements.minLength'), passwordValidation.hasMinLength)}
                  {renderRequirement(t('register.passwordRequirements.uppercase'), passwordValidation.hasUppercase)}
                  {renderRequirement(t('register.passwordRequirements.lowercase'), passwordValidation.hasLowercase)}
                  {renderRequirement(t('register.passwordRequirements.number'), passwordValidation.hasNumber)}
                </div>
              </div>
            )}

            <FormItem
              label={t('register.confirmPassword')}
              field="confirmPassword"
              required
              dependencies={['password']}
              rules={[
                { required: true, message: 'Please confirm your password' },
                {
                  validator: (value, callback) => {
                    const currentPassword = form.getFieldValue('password');
                    if (value && currentPassword && value !== currentPassword) {
                      callback(t('register.passwordMismatch'));
                    } else {
                      callback();
                    }
                  },
                },
              ]}
            >
              <Input.Password
                prefix={<IconLock />}
                placeholder="Confirm your password"
                size="large"
                tabIndex={4}
                autoComplete="new-password"
                className={`register-form-input ${passwordsMatch === false ? 'error' : passwordsMatch === true ? 'success' : ''}`}
                style={{
                  ...styles.inputFocus,
                  ...(passwordsMatch === false ? styles.inputError : {}),
                  ...(passwordsMatch === true ? styles.inputSuccess : {}),
                }}
              />
            </FormItem>
            {/* Password match indicator */}
            {passwordsMatch === true && (
              <div style={{ marginTop: '-12px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <IconCheck style={{ color: 'var(--color-success)', fontSize: '14px' }} />
                <Text style={{ fontSize: '12px', color: 'var(--color-success)' }}>
                  Passwords match
                </Text>
              </div>
            )}

            <FormItem>
              <Button
                type="primary"
                htmlType="submit"
                long
                size="large"
                loading={loading}
                tabIndex={5}
                disabled={!passwordValidation.isValid || passwordsMatch === false}
                className="register-submit-button"
                style={styles.submitButton}
              >
                {t('register.submit')}
              </Button>
            </FormItem>
          </Form>

          <div style={styles.footer}>
            <Text type="secondary">
              {t('register.hasAccount')}{' '}
              <Link>
                <RouterLink to="/login">{t('register.login')}</RouterLink>
              </Link>
            </Text>
          </div>
        </Space>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100vh',
    paddingTop: '20px',
    paddingBottom: '40px',
    paddingLeft: '20px',
    paddingRight: '20px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    overflowY: 'auto',
  },
  containerMobile: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    minHeight: '100svh', // Use small viewport height for mobile browsers
    padding: '16px',
    paddingTop: '32px',
    paddingBottom: 'calc(32px + env(safe-area-inset-bottom, 0px))',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
  },
  card: {
    width: '100%',
    maxWidth: '400px',
    padding: '32px',
    borderRadius: '8px',
    background: 'var(--color-bg-2)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
  },
  cardMobile: {
    width: '100%',
    maxWidth: '100%',
    padding: '24px 16px',
    borderRadius: '12px',
    background: 'var(--color-bg-2)',
    boxShadow: '0 4px 24px rgba(0, 0, 0, 0.1)',
  },
  header: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  footer: {
    textAlign: 'center',
    marginTop: '16px',
  },
  inputFocus: {
    transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
  },
  inputError: {
    borderColor: 'var(--color-danger)',
  },
  inputSuccess: {
    borderColor: 'var(--color-success)',
  },
  passwordRequirements: {
    marginTop: '8px',
    padding: '12px',
    background: 'var(--color-fill-1)',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--color-border-1)',
  },
  submitButton: {
    marginTop: '8px',
    transition: 'all 0.15s ease',
  },
};

export default RegisterPage;