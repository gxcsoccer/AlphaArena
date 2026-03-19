/**
 * HelpButton Component
 * A button that opens a help modal with documentation content
 */

import React, { useState, useEffect } from 'react';
import { Button, Modal, Typography, Spin, Space, Alert } from '@arco-design/web-react';
import { IconQuestionCircle, IconBook, IconLink } from '@arco-design/web-react/icon';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

const { Title, _Text, Paragraph } = Typography;

interface HelpSection {
  title: string;
  content: string;
}

interface HelpButtonProps {
  /** Button text */
  text?: string;
  /** Help sections to display */
  sections?: HelpSection[];
  /** Path to markdown file (relative to docs/) */
  docPath?: string;
  /** Button type */
  type?: 'primary' | 'secondary' | 'text' | 'outline';
  /** Button size */
  size?: 'mini' | 'small' | 'default' | 'large';
  /** Button icon */
  icon?: React.ReactNode;
  /** Whether button is compact (icon only) */
  compact?: boolean;
  /** Custom style */
  style?: React.CSSProperties;
  /** Modal title */
  modalTitle?: string;
  /** External link to full documentation */
  externalLink?: string;
}

/**
 * HelpButton opens a modal with help content.
 * 
 * @example
 * // With predefined sections
 * <HelpButton
 *   text="帮助"
 *   sections={[
 *     { title: '如何订阅', content: '...' },
 *     { title: '如何升级', content: '...' },
 *   ]}
 * />
 * 
 * @example
 * // With documentation file
 * <HelpButton
 *   text="查看帮助"
 *   docPath="user-guide/subscription.md"
 *   externalLink="/docs/user-guide/subscription.md"
 * />
 */
const HelpButton: React.FC<HelpButtonProps> = ({
  text = '帮助',
  sections,
  docPath,
  type = 'text',
  size = 'small',
  icon,
  compact = false,
  style,
  modalTitle = '帮助文档',
  externalLink,
}) => {
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [docContent, setDocContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible && docPath && !docContent && !sections) {
      loadDocumentation();
    }
  }, [visible, docPath]);

  const loadDocumentation = async () => {
    if (!docPath) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(`/docs/${docPath}`);
      if (!response.ok) {
        throw new Error('Failed to load documentation');
      }
      const markdown = await response.text();
      setDocContent(markdown);
    } catch (err: any) {
      console.error('Error loading documentation:', err);
      setError('无法加载文档内容。请稍后重试或访问在线文档。');
    } finally {
      setLoading(false);
    }
  };

  const handleExternalLink = () => {
    if (externalLink) {
      window.open(externalLink, '_blank');
    }
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <Spin size={32} />
          <div style={{ marginTop: 16, color: 'var(--color-text-3)' }}>
            加载文档中...
          </div>
        </div>
      );
    }

    if (error) {
      return (
        <Alert type="error" content={error} />
      );
    }

    if (sections) {
      return (
        <div className="help-content">
          {sections.map((section, index) => (
            <div key={index} style={{ marginBottom: index < sections.length - 1 ? 24 : 0 }}>
              <Title heading={5}>{section.title}</Title>
              <Paragraph>{section.content}</Paragraph>
            </div>
          ))}
        </div>
      );
    }

    if (docContent) {
      return (
        <div 
          className="markdown-content"
          style={{ 
            maxHeight: '60vh', 
            overflow: 'auto',
            lineHeight: 1.6,
          }}
          dangerouslySetInnerHTML={{ 
            __html: DOMPurify.sanitize(marked.parse(docContent) as string) 
          }}
        />
      );
    }

    return (
      <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-3)' }}>
        <IconBook style={{ fontSize: 48, marginBottom: 16 }} />
        <div>暂无帮助内容</div>
      </div>
    );
  };

  return (
    <>
      <Button
        type={type}
        size={size}
        style={style}
        icon={icon || <IconQuestionCircle />}
        onClick={() => setVisible(true)}
      >
        {!compact && text}
      </Button>

      <Modal
        title={
          <Space>
            <IconBook style={{ fontSize: 20 }} />
            <span>{modalTitle}</span>
          </Space>
        }
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={
          externalLink ? (
            <Button 
              type="primary" 
              icon={<IconLink />}
              onClick={handleExternalLink}
            >
              查看完整文档
            </Button>
          ) : null
        }
        style={{ width: '90%', maxWidth: 720 }}
        unmountOnExit={false}
      >
        {renderContent()}
      </Modal>
    </>
  );
};

export default HelpButton;

/**
 * Predefined help buttons for common pages
 */
export const HelpButtons = {
  subscription: {
    modalTitle: '订阅帮助',
    docPath: 'user-guide/subscription.md',
    externalLink: '/docs/user-guide/subscription.md',
  },
  aiAssistant: {
    modalTitle: 'AI 助手帮助',
    docPath: 'user-guide/ai-assistant.md',
    externalLink: '/docs/user-guide/ai-assistant.md',
  },
  alerts: {
    modalTitle: '价格提醒帮助',
    docPath: 'user-guide/alerts.md',
    externalLink: '/docs/user-guide/alerts.md',
  },
  limits: {
    modalTitle: '权限和限额说明',
    docPath: 'user-guide/limits.md',
    externalLink: '/docs/user-guide/limits.md',
  },
  quickStart: {
    modalTitle: '快速入门',
    docPath: 'user-guide/quick-start.md',
    externalLink: '/docs/user-guide/quick-start.md',
  },
};