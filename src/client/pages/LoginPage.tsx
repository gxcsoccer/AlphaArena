/**
 * Login Page
 * User authentication login form with mobile responsive design
 */

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Message, Typography, Space, Link, Grid } from '@arco-design/web-react';
import { IconUser, IconLock } from '@arco-design/web-react/icon';
import { useAuth } from '../hooks/useAuth';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

const { Title, Text } = Typography;
const FormItem = Form.Item;
const { Row, Col } = Grid;

interface LoginFormValues {
  identifier: string;
  password: string;
}

const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

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
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
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
            <Title heading={isMobile ? 4 : 3} style={{ margin: 0 }}>
              Welcome Back
            </Title>
            <Text type="secondary">Sign in to your AlphaArena account</Text>
          </div>

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
              label="Email or Username"
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
              label="Password"
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
                Sign In
              </Button>
            </FormItem>
          </Form>

          <div style={styles.footer}>
            <Text type="secondary">
              Don't have an account?{' '}
              <Link>
                <RouterLink to="/register">Sign up</RouterLink>
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
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  containerMobile: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: '100vh',
    padding: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
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
