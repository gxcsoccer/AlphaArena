import React, { useEffect, useState } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import { Spin, Message } from '@arco-design/web-react';

/**
 * API Documentation Page
 * Displays Swagger UI with the OpenAPI specification
 */
const ApiDocsPage: React.FC = () => {
  const [spec, setSpec] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch the OpenAPI spec from public directory
    fetch('/openapi.yaml')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load API spec: ${response.status}`);
        }
        return response.text();
      })
      .then((yamlContent) => {
        setSpec(yamlContent);
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
        }}
      >
        <Message type="error" style={{ width: 'auto' }}>
          {error}
        </Message>
        <p>Please ensure the OpenAPI spec file is available at /openapi.yaml</p>
      </div>
    );
  }

  return (
    <div className="api-docs-page">
      <SwaggerUI spec={spec} />
    </div>
  );
};

export default ApiDocsPage;
