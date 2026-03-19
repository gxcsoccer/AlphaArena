/**
 * AIAssistantPanel Component
 * AI-powered trading strategy assistant chat interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Spin, Message, Empty, Avatar, Tooltip, Modal, Select, Divider, Tag } from '@arco-design/web-react';
import { IconSend, IconDelete, IconRefresh, IconBulb, IconLine, IconTrophy, IconExclamationCircle } from '@arco-design/web-react/icon';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './AIAssistantPanel.css';
import HelpButton, { HelpButtons } from './HelpButton';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  created_at: string;
}

interface AIAssistantPanelProps {
  userId?: string;
  context?: {
    currentStrategy?: any;
    currentPortfolio?: any;
    marketData?: any;
  };
}

interface UsageStats {
  tokensUsed: number;
  tokensLimit: number;
  messagesToday: number;
  messagesLimit: number;
  planType: 'free' | 'pro';
}

// LocalStorage keys
const MESSAGES_STORAGE_KEY = 'ai_assistant_messages';
const CONVERSATION_ID_KEY = 'ai_assistant_conversation_id';

// Helper functions for localStorage
const storage = {
  getMessages: (): ChatMessage[] => {
    try {
      const stored = localStorage.getItem(MESSAGES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        return parsed.map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
        }));
      }
    } catch (e) {
      console.error('Failed to load messages from localStorage:', e);
    }
    return [];
  },
  saveMessages: (messages: ChatMessage[]): void => {
    try {
      localStorage.setItem(MESSAGES_STORAGE_KEY, JSON.stringify(messages));
    } catch (e) {
      console.error('Failed to save messages to localStorage:', e);
    }
  },
  getConversationId: (): string | null => {
    return localStorage.getItem(CONVERSATION_ID_KEY);
  },
  saveConversationId: (id: string | null): void => {
    if (id) {
      localStorage.setItem(CONVERSATION_ID_KEY, id);
    } else {
      localStorage.removeItem(CONVERSATION_ID_KEY);
    }
  },
};

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ userId, context }) => {
  // Initialize from localStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => storage.getMessages());
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(() => storage.getConversationId());
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const [showMarketAnalysis, setShowMarketAnalysis] = useState(false);
  const [showStrategyOptimize, setShowStrategyOptimize] = useState(false);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTC/USDT');
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Common trading pairs
  const tradingPairs = [
    'BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'SOL/USDT', 'XRP/USDT',
    'ADA/USDT', 'DOGE/USDT', 'DOT/USDT', 'MATIC/USDT', 'LINK/USDT'
  ];

  // Fetch usage stats on mount
  useEffect(() => {
    fetchUsageStats();
  }, []);

  // Save messages to localStorage when they change
  useEffect(() => {
    storage.saveMessages(messages);
  }, [messages]);

  // Save conversation ID when it changes
  useEffect(() => {
    storage.saveConversationId(conversationId);
  }, [conversationId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchUsageStats = async () => {
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) return;

      const response = await fetch('/api/ai/usage', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsageStats(data.data);
      }
    } catch (error) {
      console.error('Failed to fetch usage stats:', error);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) {
        Message.error('Please login to use AI assistant');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation_id: conversationId,
          context,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.upgrade_required) {
          setShowUpgradePrompt(true);
          setUsageStats(prev => prev ? { ...prev, planType: 'free' } : { tokensUsed: 0, tokensLimit: 0, messagesToday: 0, messagesLimit: 5, planType: 'free' });
        } else {
          throw new Error(error.error || 'Failed to get AI response');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.data.conversation_id);
      
      // Update usage stats
      if (data.data.tokens_used) {
        setUsageStats(prev => prev ? {
          ...prev,
          tokensUsed: (prev.tokensUsed || 0) + data.data.tokens_used,
          messagesToday: (prev.messagesToday || 0) + 1,
        } : null);
      }
    } catch (error: any) {
      console.error('Error sending message:', error);
      Message.error(error.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearConversation = async () => {
    if (!conversationId) {
      setMessages([]);
      storage.saveMessages([]);
      return;
    }

    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) return;

      await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setMessages([]);
      setConversationId(null);
      storage.saveMessages([]);
      storage.saveConversationId(null);
      Message.success('Conversation cleared');
    } catch (error) {
      console.error('Error clearing conversation:', error);
      Message.error('Failed to clear conversation');
    }
  };

  const handleMarketAnalysis = async () => {
    if (!selectedSymbol) return;
    
    setAnalysisLoading(true);
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) {
        Message.error('Please login to use AI assistant');
        setAnalysisLoading(false);
        return;
      }

      const response = await fetch('/api/ai/analyze/market', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          symbol: selectedSymbol,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.upgrade_required) {
          setShowUpgradePrompt(true);
        } else {
          throw new Error(error.error || 'Failed to analyze market');
        }
        setAnalysisLoading(false);
        return;
      }

      const data = await response.json();
      
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: `Analyze ${selectedSymbol} market`,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.analysis || data.data.response || JSON.stringify(data.data, null, 2),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setShowMarketAnalysis(false);
    } catch (error: any) {
      console.error('Error analyzing market:', error);
      Message.error(error.message || 'Failed to analyze market');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleStrategyOptimize = async () => {
    if (!selectedStrategy) return;
    
    setAnalysisLoading(true);
    try {
      const token = localStorage.getItem('supabase_token') || localStorage.getItem('auth_access_token');
      if (!token) {
        Message.error('Please login to use AI assistant');
        setAnalysisLoading(false);
        return;
      }

      const response = await fetch('/api/ai/analyze/strategy', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          strategy_id: selectedStrategy,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        if (error.upgrade_required) {
          setShowUpgradePrompt(true);
        } else {
          throw new Error(error.error || 'Failed to optimize strategy');
        }
        setAnalysisLoading(false);
        return;
      }

      const data = await response.json();
      
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: `Optimize strategy: ${selectedStrategy}`,
        timestamp: new Date(),
      };

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.suggestions || data.data.response || JSON.stringify(data.data, null, 2),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setShowStrategyOptimize(false);
    } catch (error: any) {
      console.error('Error optimizing strategy:', error);
      Message.error(error.message || 'Failed to optimize strategy');
    } finally {
      setAnalysisLoading(false);
    }
  };

  const quickActions = [
    { label: '📊 Market Analysis', prompt: 'Analyze the current market trend for BTC/USDT', action: () => setShowMarketAnalysis(true) },
    { label: '💡 Strategy Tips', prompt: 'What are some tips for improving my trading strategy?' },
    { label: '⚠️ Risk Management', prompt: 'How should I manage risk in my current portfolio?' },
    { label: '📈 Explain MACD', prompt: 'Can you explain how MACD indicator works?' },
    { label: '🎯 Entry Points', prompt: 'What are the best practices for determining entry points?' },
    { label: '🔄 Exit Strategy', prompt: 'How do I determine the best exit strategy for my trades?' },
  ];

  return (
    <div className="ai-assistant-panel">
      {/* Header with usage stats */}
      <div className="ai-assistant-header">
        <Title heading={5}>
          <IconBulb style={{ marginRight: 8 }} />
          AI Strategy Assistant
          <HelpButton
            compact
            type="text"
            size="mini"
            {...HelpButtons.aiAssistant}
          />
        </Title>
        <Space>
          {usageStats && usageStats.planType === 'pro' && (
            <Tag color="green" icon={<IconTrophy />}>Pro</Tag>
          )}
          {usageStats && usageStats.planType === 'free' && (
            <Button
              size="small"
              type="primary"
              onClick={() => setShowUpgradePrompt(true)}
            >
              Upgrade to Pro
            </Button>
          )}
          <Tooltip content="Clear conversation">
            <Button
              icon={<IconDelete />}
              size="small"
              onClick={handleClearConversation}
              disabled={messages.length === 0}
            />
          </Tooltip>
        </Space>
      </div>

      {/* Usage stats for Pro users */}
      {usageStats && usageStats.planType === 'pro' && (
        <div className="ai-usage-stats">
          <Space size="large">
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Messages Today</Text>
              <div>
                <Text strong>{usageStats.messagesToday}</Text>
                <Text type="secondary"> / {usageStats.messagesLimit === -1 ? '∞' : usageStats.messagesLimit}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Tokens Used</Text>
              <div>
                <Text strong>{usageStats.tokensUsed?.toLocaleString()}</Text>
                {usageStats.tokensLimit > 0 && (
                  <Text type="secondary"> / {usageStats.tokensLimit?.toLocaleString()}</Text>
                )}
              </div>
            </div>
          </Space>
        </div>
      )}

      {/* Messages area */}
      <div className="ai-assistant-messages">
        {messages.length === 0 ? (
          <div className="ai-assistant-empty">
            <Empty
              icon={<IconBulb style={{ fontSize: 48, color: '#165dff' }} />}
              description={
                <div>
                  <Text>Ask me anything about trading strategies, market analysis, or risk management.</Text>
                  <div className="quick-actions">
                    {quickActions.map((action, index) => (
                      <Button
                        key={index}
                        size="small"
                        onClick={() => {
                          if (action.action) {
                            action.action();
                          } else {
                            setInputValue(action.prompt);
                          }
                        }}
                      >
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </div>
              }
            />
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <div
                key={message.id}
                className={`ai-message ai-message-${message.role}`}
              >
                <div className="ai-message-avatar">
                  <Avatar size={32}>
                    {message.role === 'user' ? '👤' : '🤖'}
                  </Avatar>
                </div>
                <div className="ai-message-content">
                  <div className="ai-message-text">
                    {message.role === 'assistant' ? (
                      <div 
                        dangerouslySetInnerHTML={{ 
                          __html: DOMPurify.sanitize(marked.parse(message.content) as string) 
                        }}
                      />
                    ) : (
                      <Text>{message.content}</Text>
                    )}
                  </div>
                  <div className="ai-message-time">
                    <Text type="secondary" style={{ fontSize: 12 }}>
                      {message.timestamp.toLocaleTimeString()}
                    </Text>
                  </div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="ai-message ai-message-assistant">
                <div className="ai-message-avatar">
                  <Avatar size={32}>🤖</Avatar>
                </div>
                <div className="ai-message-content">
                  <Spin size={20} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="ai-assistant-input">
        <TextArea
          value={inputValue}
          onChange={setInputValue}
          onKeyPress={handleKeyPress}
          placeholder="Ask about market trends, strategy optimization, or trading tips..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={loading}
        />
        <Button
          type="primary"
          icon={<IconSend />}
          onClick={handleSendMessage}
          loading={loading}
          disabled={!inputValue.trim()}
        />
      </div>

      {/* Market Analysis Modal */}
      <Modal
        title="📊 Market Analysis"
        visible={showMarketAnalysis}
        onCancel={() => setShowMarketAnalysis(false)}
        onOk={handleMarketAnalysis}
        confirmLoading={analysisLoading}
        okText="Analyze"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Select a trading pair to analyze:</Text>
        </div>
        <Select
          value={selectedSymbol}
          onChange={setSelectedSymbol}
          style={{ width: '100%' }}
          placeholder="Select trading pair"
        >
          {tradingPairs.map(pair => (
            <Select.Option key={pair} value={pair}>{pair}</Select.Option>
          ))}
        </Select>
      </Modal>

      {/* Strategy Optimization Modal */}
      <Modal
        title="💡 Strategy Optimization"
        visible={showStrategyOptimize}
        onCancel={() => setShowStrategyOptimize(false)}
        onOk={handleStrategyOptimize}
        confirmLoading={analysisLoading}
        okText="Optimize"
      >
        <div style={{ marginBottom: 16 }}>
          <Text>Enter strategy ID to optimize:</Text>
        </div>
        <Input
          value={selectedStrategy}
          onChange={setSelectedStrategy}
          placeholder="Enter strategy ID (e.g., strategy_123)"
        />
      </Modal>

      {/* Upgrade Prompt Modal */}
      <Modal
        title={
          <span>
            <IconTrophy style={{ marginRight: 8, color: '#165dff' }} />
            Upgrade to Pro
          </span>
        }
        visible={showUpgradePrompt}
        onCancel={() => setShowUpgradePrompt(false)}
        footer={
          <Space>
            <Button onClick={() => setShowUpgradePrompt(false)}>Maybe Later</Button>
            <Button type="primary" onClick={() => {
              setShowUpgradePrompt(false);
              window.location.href = '/subscription';
            }}>
              View Plans
            </Button>
          </Space>
        }
      >
        <div className="upgrade-prompt-content">
          <div className="upgrade-benefits">
            <Title heading={5}>Pro Benefits:</Title>
            <ul>
              <li>✅ Unlimited AI conversations</li>
              <li>✅ Advanced market analysis</li>
              <li>✅ Strategy optimization suggestions</li>
              <li>✅ Priority support</li>
              <li>✅ Real-time trading alerts</li>
            </ul>
          </div>
          <Divider />
          <div className="upgrade-comparison">
            <div className="plan-comparison">
              <div className="plan-free">
                <Text bold>Free</Text>
                <ul>
                  <li>5 messages/day</li>
                  <li>Basic analysis</li>
                </ul>
              </div>
              <div className="plan-pro">
                <Text bold type="success">Pro</Text>
                <ul>
                  <li>Unlimited messages</li>
                  <li>Advanced analysis</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default AIAssistantPanel;
