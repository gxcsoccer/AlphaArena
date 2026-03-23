/**
 * Register Page
 * New user registration form with mobile responsive design
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Message, Typography, Space, Link, Grid } from '@arco-design/web-react';
import { IconUser, IconLock, IconEmail } from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';
import { Logo } from '../components/brand/Logo';

const { Title, Text } = Typography;
const FormItem = Form.Item;
const { _Row, _Col } = Grid;

interface RegisterFormValues {
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
}

const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [isMobile, setIsMobile] = useState(false);

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

  const handleSubmit = async (values: RegisterFormValues) => {
    // Check password confirmation
    if (values.password !== values.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    setError(null);
    setErrors([]);

    try {
      await register({
        email: values.email,
        username: values.username || undefined,
        password: values.password,
      });
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      
      if ((err as any).details) {
        setErrors((err as any).details);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={isMobile ? styles.containerMobile : styles.container}>
      <div style={isMobile ? styles.cardMobile : styles.card}>
        <Space direction="vertical" size={isMobile ? 'medium' : 'large'} style={{ width: '100%' }}>
          <div style={styles.header}>
            <Logo size="lg" showWordmark={true} onClick={() => navigate('/')} />
            <Title heading={isMobile ? 5 : 4} style={{ margin: '16px 0 8px' }}>
              创建账户
            </Title>
            <Text type="secondary">加入 AlphaArena，开启量化交易之旅</Text>
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

          <Form
            layout="vertical"
            autoComplete="off"
            onSubmit={handleSubmit as any}
            style={{ width: '100%' }}
          >
            <FormItem
              label="Email"
              field="email"
              rules={[
                { required: true, message: 'Please enter your email' },
                { type: 'email', message: 'Please enter a valid email' },
              ]}
            >
              <Input
                prefix={<IconEmail />}
                placeholder="Enter your email"
                size="large"
              />
            </FormItem>

            <FormItem
              label="Username (optional)"
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
              />
            </FormItem>

            <FormItem
              label="Password"
              field="password"
              rules={[
                { required: true, message: 'Please enter your password' },
                { minLength: 8, message: 'Password must be at least 8 characters' },
              ]}
              extra={
                !isMobile && (
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Must contain: 8+ characters, uppercase, lowercase, and number
                  </Text>
                )
              }
            >
              <Input.Password
                prefix={<IconLock />}
                placeholder="Create a password"
                size="large"
              />
            </FormItem>

            <FormItem
              label="Confirm Password"
              field="confirmPassword"
              rules={[
                { required: true, message: 'Please confirm your password' },
              ]}
            >
              <Input.Password
                prefix={<IconLock />}
                placeholder="Confirm your password"
                size="large"
              />
            </FormItem>

            {isMobile && (
              <Text type="secondary" style={{ fontSize: '12px', display: 'block', marginBottom: 16 }}>
                Must contain: 8+ characters, uppercase, lowercase, and number
              </Text>
            )}

            <FormItem>
              <Button
                type="primary"
                htmlType="submit"
                long
                size="large"
                loading={loading}
              >
                Create Account
              </Button>
            </FormItem>
          </Form>

          <div style={styles.footer}>
            <Text type="secondary">
              Already have an account?{' '}
              <Link>
                <RouterLink to="/login">Sign in</RouterLink>
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
    alignItems: 'flex-start',
    minHeight: '100vh',
    padding: '16px',
    paddingTop: '32px',
    background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    overflowY: 'auto',
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

export default RegisterPage;
