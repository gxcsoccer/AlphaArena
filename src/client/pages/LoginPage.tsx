/**
 * Login Page
 * User authentication login form with mobile responsive design
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Message, Typography, Space, Link, Grid } from '@arco-design/web-react';
import { IconUser, IconLock } from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/brand/Logo';

const { Title, Text } = Typography;
const FormItem = Form.Item;
const { _Row, _Col } = Grid;

interface LoginFormValues {
  identifier: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useTranslation('auth');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Get the redirect path from location state (set by ProtectedRoute)
  const redirectPath = (location.state as any)?.from || '/dashboard';

  // SEO: Update meta tags for login page
  useSEO(PAGE_SEO_CONFIGS.login);

  // Detect mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const handleSubmit = async (values: LoginFormValues) => {
    setLoading(true);
    setError(null);
    setRemainingAttempts(null);

    try {
      await login(values);
      // Navigate to the originally intended page or dashboard
      navigate(redirectPath, { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : t('login.error');
      setError(message);
      
      // Check if remaining attempts info is available
      if (message.includes('Invalid credentials') && (err as any).remainingAttempts !== undefined) {
        setRemainingAttempts((err as any).remainingAttempts);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={isMobile ? styles.containerMobile : styles.container}>
      <div style={isMobile ? styles.cardMobile : styles.card}>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={styles.header}>
            <Logo size="lg" showWordmark={true} onClick={() => navigate('/')} />
            <Title heading={isMobile ? 5 : 4} style={{ margin: '16px 0 8px' }}>
              {t('login.subtitle')}
            </Title>
            <Text type="secondary">{t('login.loginSubtitle')}</Text>
          </div>

          {/* Show message if redirected from a protected page */}
          {redirectPath !== '/dashboard' && (
            <Message type="warning">
              请登录以访问您请求的页面
            </Message>
          )}

          {error && (
            <Message type="error">
              {error}
              {remainingAttempts !== null && remainingAttempts > 0 && (
                <Text> ({remainingAttempts} attempts remaining)</Text>
              )}
            </Message>
          )}

          <Form
            layout="vertical"
            autoComplete="off"
            onSubmit={handleSubmit as any}
            style={{ width: '100%' }}
          >
            <FormItem
              label={t('login.email')}
              field="identifier"
              rules={[
                { required: true, message: 'Please enter your email or username' },
              ]}
            >
              <Input
                prefix={<IconUser />}
                placeholder="Enter your email or username"
                size="large"
              />
            </FormItem>

            <FormItem
              label={t('login.password')}
              field="password"
              rules={[{ required: true, message: 'Please enter your password' }]}
            >
              <Input.Password
                prefix={<IconLock />}
                placeholder="Enter your password"
                size="large"
              />
            </FormItem>

            <FormItem>
              <Button
                type="primary"
                htmlType="submit"
                long
                size="large"
                loading={loading}
              >
                {t('login.submit')}
              </Button>
            </FormItem>
          </Form>

          <div style={styles.footer}>
            <Text type="secondary">
              {t('login.noAccount')}{' '}
              <Link>
                <RouterLink to="/register">{t('login.register')}</RouterLink>
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
    alignItems: 'center',
    minHeight: '100vh',
    padding: '20px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
  },
  containerMobile: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '16px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
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
};

export default LoginPage;
