import React, { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Spin, Message, Typography, Card, Space, Button } from '@arco-design/web-react';
import { IconDownload, IconCode, IconBook } from '@arco-design/web-react/icon';

const { Title, Paragraph } = Typography;

/**
 * API Documentation Page
 * Displays Swagger UI with the OpenAPI specification
 * 
 * Features:
 * - Try It Out functionality enabled
 * - Authorization persistence
 * - Request duration display
 * - Filter and search capabilities
 */
const ApiDocsPage: React.FC = () => {
  const [spec, setSpec] = useState<object | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the OpenAPI spec from the backend API
    // This uses the auto-generated spec from JSDoc comments
    fetch('/docs/api/openapi.json')
      .then((response) => {
        if (!response.ok) {
          // Fallback to public directory
          return fetch('/openapi.yaml').then((res) => {
            if (!res.ok) {
              throw new Error(`Failed to load API spec: ${res.status}`);
            }
            return res.text();
          }).then((yamlText) => {
            // Parse YAML to JSON
            return YAML.parse(yamlText);
          });
        }
        return response.json();
      })
      .then((specData) => {
        setSpec(specData);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading OpenAPI spec:', err);
        setError(err.message);
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        <Spin size={40} tip="Loading API Documentation..." />
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: '16px',
          padding: '24px',
        }}
      >
        <Message type="error" style={{ width: 'auto' }}>
          {error}
        </Message>
        <p>Please ensure the API server is running and the OpenAPI spec is available.</p>
        <Space>
          <Button 
            type="primary" 
            onClick={() => window.location.reload()}
          >
            Retry
          </Button>
          <Button 
            onClick={() => window.open('/api-docs', '_blank')}
          >
            Open Legacy Docs
          </Button>
        </Space>
      </div>
    );
  }

  return (
    <div className="api-docs-page" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header section */}
      <Card 
        style={{ marginBottom: 16 }}
        bordered={false}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <IconBook style={{ fontSize: 24, color: 'var(--color-primary)' }} />
            <div>
              <Title heading={5} style={{ margin: 0 }}>API Documentation</Title>
              <Paragraph style={{ margin: 0, color: 'var(--color-text-3)' }}>
                Interactive API documentation with Try It Out functionality
              </Paragraph>
            </div>
          </Space>
          <Space>
            <Button 
              icon={<IconDownload />}
              onClick={() => window.open('/docs/api/openapi.json', '_blank')}
            >
              Download JSON
            </Button>
            <Button 
              icon={<IconCode />}
              onClick={() => window.open('/openapi.yaml', '_blank')}
            >
              View YAML
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
          defaultModelsExpandDepth={1}
          defaultModelExpandDepth={1}
          displayRequestDuration={true}
          docExpansion="list"
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

// Simple YAML parser for fallback
const YAML = {
  parse: (yaml: string): object => {
    // This is a very basic YAML parser for the fallback case
    // In production, you'd use a proper library
    try {
      // Try to use js-yaml if available
      // @ts-ignore
      if (window.jsyaml) {
        // @ts-ignore
        return window.jsyaml.load(yaml);
      }
      // Fallback: try JSON parse (in case it's actually JSON)
      return JSON.parse(yaml);
    } catch {
      console.warn('YAML parsing failed, returning empty object');
      return {};
    }
  }
};

export default ApiDocsPage;