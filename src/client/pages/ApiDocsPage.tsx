import React, { useEffect, useState, useCallback } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Spin, Message, Typography, Card, Space, Button, Drawer, Input, Grid } from '@arco-design/web-react';
import { IconDownload, IconCode, IconBook, IconSearch, IconMenu } from '@arco-design/web-react/icon';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { useSEO, PAGE_SEO_CONFIGS } from '../hooks/useSEO';

const { Title, Paragraph } = Typography;
const { _Row, _Col } = Grid;

/**
 * API Documentation Page
 * Displays Swagger UI with the OpenAPI specification
 * 
 * Features:
 * - Try It Out functionality enabled
 * - Authorization persistence
 * - Request duration display
 * - Filter and search capabilities
 * - Mobile responsive design with collapsible sections
 */
const ApiDocsPage: React.FC = () => {
  // SEO: Update meta tags for API docs page
  useSEO(PAGE_SEO_CONFIGS.apiDocs);
  
  const [spec, setSpec] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  
  const { isMobile, isTablet } = useMediaQuery();

  useEffect(() => {
    // Fetch the OpenAPI spec - try static JSON first (works in production without backend)
    const loadSpec = async () => {
      // Try static openapi.json first (works in production without backend, no YAML parser needed)
      try {
        const staticResponse = await fetch('/openapi.json');
        if (staticResponse.ok) {
          const specData = await staticResponse.json();
          console.log('Loaded OpenAPI spec from static JSON');
          setSpec(specData);
          setLoading(false);
          return;
        }
      } catch (_err) {
        console.log('Static openapi.json not available, trying YAML...');
      }

      // Try static openapi.yaml as fallback
      try {
        const yamlResponse = await fetch('/openapi.yaml');
        if (yamlResponse.ok) {
          const yamlText = await yamlResponse.text();
          // @ts-expect-error - jsyaml is loaded from CDN
          if (window.jsyaml) {
            // @ts-expect-error - jsyaml is loaded from CDN
            const specData = window.jsyaml.load(yamlText);
            console.log('Loaded OpenAPI spec from static YAML');
            setSpec(specData);
            setLoading(false);
            return;
          } else {
            console.warn('js-yaml not loaded, cannot parse YAML');
          }
        }
      } catch (_err) {
        console.log('Static openapi.yaml not available, trying backend...');
      }

      // Fallback to backend API endpoint (works in development with running backend)
      try {
        const response = await fetch('/docs/api/openapi.json');
        if (response.ok) {
          const specData = await response.json();
          console.log('Loaded OpenAPI spec from backend');
          setSpec(specData);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to load API spec: ${response.status}`);
      } catch (err: any) {
        console.error('Error loading OpenAPI spec:', err);
        setError(err.message || 'Failed to load API documentation');
        setLoading(false);
      }
    };

    loadSpec();
  }, []);

  const handleRetry = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try static JSON first
      const staticResponse = await fetch('/openapi.json');
      if (staticResponse.ok) {
        const specData = await staticResponse.json();
        setSpec(specData);
        setLoading(false);
        return;
      }
      
      // Fallback to backend
      const response = await fetch('/docs/api/openapi.json');
      if (response.ok) {
        const specData = await response.json();
        setSpec(specData);
        setLoading(false);
        return;
      }
      throw new Error('Failed to load API spec');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }, []);

  // Loading state
  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: isMobile ? 'calc(100vh - 120px)' : '100vh',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <Spin size={isMobile ? 32 : 40} />
        <Typography.Text type="secondary">
          Loading API Documentation...
        </Typography.Text>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: isMobile ? 'calc(100vh - 120px)' : '100vh',
          flexDirection: 'column',
          gap: 16,
          padding: 24,
          textAlign: 'center',
        }}
      >
        <Message type="error" style={{ width: 'auto' }}>
          {error}
        </Message>
        <Typography.Text type="secondary">
          Please ensure the API server is running and the OpenAPI spec is available.
        </Typography.Text>
        <Space direction={isMobile ? 'vertical' : 'horizontal'}>
          <Button 
            type="primary" 
            onClick={handleRetry}
            long={isMobile}
          >
            Retry
          </Button>
          <Button 
            onClick={() => window.open('/api-docs', '_blank')}
            long={isMobile}
          >
            Open Legacy Docs
          </Button>
        </Space>
      </div>
    );
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="api-docs-page api-docs-page--mobile" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Mobile Header */}
        <div 
          style={{ 
            padding: '12px 16px',
            borderBottom: '1px solid var(--color-border-1)',
            background: 'var(--color-bg-2)',
            position: 'sticky',
            top: 0,
            zIndex: 10,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Space>
              <IconBook style={{ fontSize: 20, color: 'var(--color-primary)' }} />
              <Title heading={5} style={{ margin: 0 }}>API Docs</Title>
            </Space>
            <Button
              type="text"
              icon={<IconMenu />}
              onClick={() => setMobileMenuVisible(true)}
              aria-label="Open menu"
            />
          </div>
          
          {/* Mobile Search */}
          <Input
            prefix={<IconSearch />}
            placeholder="Search endpoints..."
            value={searchQuery}
            onChange={setSearchQuery}
            style={{ borderRadius: 8 }}
          />
        </div>

        {/* Mobile Swagger UI */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          <SwaggerUI 
            spec={spec} 
            deepLinking={true}
            displayOperationId={false}
            defaultModelsExpandDepth={0}
            defaultModelExpandDepth={0}
            displayRequestDuration={true}
            docExpansion="none"
            filter={searchQuery || true}
            persistAuthorization={true}
            showExtensions={false}
            showCommonExtensions={true}
            tryItOutEnabled={true}
          />
        </div>

        {/* Mobile Menu Drawer */}
        <Drawer
          title="API Documentation"
          visible={mobileMenuVisible}
          onClose={() => setMobileMenuVisible(false)}
          placement="bottom"
          height="auto"
          style={{ borderRadius: '16px 16px 0 0' }}
        >
          <Space direction="vertical" style={{ width: '100%' }} size="large">
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Export</Typography.Text>
              <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
                <Button 
                  icon={<IconDownload />}
                  onClick={() => window.open('/docs/api/openapi.json', '_blank')}
                  style={{ flex: 1 }}
                >
                  JSON
                </Button>
                <Button 
                  icon={<IconCode />}
                  onClick={() => window.open('/openapi.yaml', '_blank')}
                  style={{ flex: 1 }}
                >
                  YAML
                </Button>
              </div>
            </div>
            
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>Quick Links</Typography.Text>
              <div style={{ marginTop: 8 }}>
                <Typography.Paragraph style={{ marginBottom: 8 }}>
                  Interactive API documentation with Try It Out functionality. Tap on any endpoint to expand and test.
                </Typography.Paragraph>
              </div>
            </div>
          </Space>
        </Drawer>
      </div>
    );
  }

  // Desktop/Tablet layout
  return (
    <div className="api-docs-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header section */}
      <Card 
        style={{ marginBottom: isTablet ? 12 : 16 }}
        bordered={false}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <Space>
            <IconBook style={{ fontSize: isTablet ? 20 : 24, color: 'var(--color-primary)' }} />
            <div>
              <Title heading={5} style={{ margin: 0 }}>API Documentation</Title>
              <Paragraph style={{ margin: 0, color: 'var(--color-text-3)', fontSize: isTablet ? 13 : 14 }}>
                Interactive API documentation with Try It Out functionality
              </Paragraph>
            </div>
          </Space>
          <Space size="small">
            <Button 
              icon={<IconDownload />}
              onClick={() => window.open('/docs/api/openapi.json', '_blank')}
              size={isTablet ? 'small' : 'default'}
            >
              {isTablet ? 'JSON' : 'Download JSON'}
            </Button>
            <Button 
              icon={<IconCode />}
              onClick={() => window.open('/openapi.yaml', '_blank')}
              size={isTablet ? 'small' : 'default'}
            >
              {isTablet ? 'YAML' : 'View YAML'}
            </Button>
          </Space>
        </div>
      </Card>

      {/* Swagger UI */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <SwaggerUI 
          spec={spec} 
          deepLinking={true}
          displayOperationId={false}
          defaultModelsExpandDepth={isTablet ? 0 : 1}
          defaultModelExpandDepth={isTablet ? 0 : 1}
          displayRequestDuration={true}
          docExpansion={isTablet ? 'list' : 'list'}
          filter={true}
          persistAuthorization={true}
          showExtensions={true}
          showCommonExtensions={true}
          tryItOutEnabled={true}
          requestSnippetsEnabled={true}
          requestSnippets={{
            generators: {
              curl_bash: {
                title: "cURL (bash)",
                syntax: "bash"
              },
              curl_powershell: {
                title: "cURL (PowerShell)",
                syntax: "powershell"
              },
              curl_cmd: {
                title: "cURL (CMD)",
                syntax: "bash"
              },
            },
            defaultExpanded: true,
            languages: null
          }}
        />
      </div>
    </div>
  );
};

export default ApiDocsPage;