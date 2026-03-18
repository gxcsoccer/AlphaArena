/**
 * AIAssistantPanel Component
 * AI-powered trading strategy assistant chat interface
 */

import React, { useState, useRef, useEffect } from 'react';
import { Card, Input, Button, Space, Typography, Spin, Message, Empty, Avatar, Tooltip } from '@arco-design/web-react';
import { IconSend, IconDelete, IconRefresh, IconBulb, IconLine } from '@arco-design/web-react/icon';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import './AIAssistantPanel.css';

const { TextArea } = Input;
const { Text, Title } = Typography;

interface Message {
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

const AIAssistantPanel: React.FC<AIAssistantPanelProps> = ({ userId, context }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setLoading(true);

    try {
      const token = localStorage.getItem('supabase_token');
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
          Message.warning('AI features require a Pro subscription');
        } else {
          throw new Error(error.error || 'Failed to get AI response');
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.data.response,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setConversationId(data.data.conversation_id);
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
      return;
    }

    try {
      const token = localStorage.getItem('supabase_token');
      if (!token) return;

      await fetch(`/api/ai/conversations/${conversationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      setMessages([]);
      setConversationId(null);
      Message.success('Conversation cleared');
    } catch (error) {
      console.error('Error clearing conversation:', error);
      Message.error('Failed to clear conversation');
    }
  };

  const quickActions = [
    { label: 'Analyze Market', prompt: 'Analyze the current market trend for BTC/USDT' },
    { label: 'Strategy Tips', prompt: 'What are some tips for improving my trading strategy?' },
    { label: 'Risk Management', prompt: 'How should I manage risk in my current portfolio?' },
    { label: 'Explain MACD', prompt: 'Can you explain how MACD indicator works?' },
  ];

  return (
    <Card className="ai-assistant-panel">
      <div className="ai-assistant-header">
        <Title heading={5}>
          <IconBulb style={{ marginRight: 8 }} />
          AI Strategy Assistant
        </Title>
        <Space>
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
                          setInputValue(action.prompt);
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
    </Card>
  );
};

export default AIAssistantPanel;
