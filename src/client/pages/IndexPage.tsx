/**
 * Index Page - Conditional routing based on authentication
 * Shows LandingPage for unauthenticated users
 * Shows HomePage (trading interface) for authenticated users
 */

import React from 'react';
import { useAuth } from '../hooks/useAuth';
import LandingPage from './LandingPage';
import HomePage from './HomePage';
import { Spin } from '@arco-design/web-react';

const IndexPage: React.FC = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <Spin size={40} />
      </div>
    );
  }

  // Authenticated users see the trading interface
  // Unauthenticated users see the landing page
  return isAuthenticated ? <HomePage /> : <LandingPage />;
};

export default IndexPage;