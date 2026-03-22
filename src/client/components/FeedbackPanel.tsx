/**
 * FeedbackPanel - User Feedback Form Component
 * 
 * Provides a form for users to submit feedback including:
 * - Feedback type selection (bug, suggestion, other)
 * - Text description
 * - Screenshot upload (optional)
 * - Auto-collected environment info
 * - Optional contact info
 */

import React, { useState, useCallback } from 'react';
import {
  Form,
  Input,
  Radio,
  Button,
  Upload,
  Message,
  Space,
  Typography,
  Divider,
} from '@arco-design/web-react';
import {
  IconBug,
  IconBulb,
  IconMessage,
  IconDelete,
  IconCamera,
} from '@arco-design/web-react/icon';
import { apiClient } from '../utils/apiClient';

const { TextArea } = Input;
const { Title, Text } = Typography;
const FormItem = Form.Item;

export type FeedbackType = 'bug' | 'suggestion' | 'other';

export interface FeedbackData {
  type: FeedbackType;
  description: string;
  screenshot?: string; // Base64 encoded image
  screenshotName?: string;
  contactInfo?: string;
  environment: {
    url: string;
    userAgent: string;
    screenSize: string;
    timestamp: string;
    locale: string;
    referrer: string;
  };
}

interface FeedbackPanelProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

const FeedbackPanel: React.FC<FeedbackPanelProps> = ({ onSuccess, onCancel }) => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [screenshotName, setScreenshotName] = useState<string>('');
  const [quickFeedback, setQuickFeedback] = useState<'like' | 'dislike' | null>(null);

  // Get environment info
  const getEnvironmentInfo = useCallback(() => {
    return {
      url: window.location.href,
      userAgent: navigator.userAgent,
      screenSize: `${window.screen.width}x${window.screen.height}`,
      timestamp: new Date().toISOString(),
      locale: navigator.language,
      referrer: document.referrer || 'Direct',
    };
  }, []);

  // Handle screenshot upload
  const handleScreenshotChange = useCallback((fileList: any[]) => {
    const file = fileList[0];
    if (file && file.originFile) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        setScreenshotPreview(base64);
        setScreenshotName(file.originFile.name);
      };
      reader.readAsDataURL(file.originFile);
    } else {
      setScreenshotPreview(null);
      setScreenshotName('');
    }
    return false; // Prevent auto upload
  }, []);

  // Remove screenshot
  const handleRemoveScreenshot = useCallback(() => {
    setScreenshotPreview(null);
    setScreenshotName('');
  }, []);

  // Handle quick feedback (like/dislike)
  const handleQuickFeedback = useCallback((type: 'like' | 'dislike') => {
    setQuickFeedback(type);
    form.setFieldValue('type', type === 'like' ? 'suggestion' : 'bug');
    form.setFieldValue('description', type === 'like' ? '很好用！' : '需要改进');
  }, [form]);

  // Handle form submit
  const handleSubmit = useCallback(async () => {
    try {
      await form.validate();
      const values = form.getFieldsValue();

      setLoading(true);

      const feedbackData: FeedbackData = {
        type: values.type || 'other',
        description: values.description || '',
        screenshot: screenshotPreview || undefined,
        screenshotName: screenshotName || undefined,
        contactInfo: values.contactInfo || undefined,
        environment: getEnvironmentInfo(),
      };

      const result = await apiClient.post('/api/feedback', feedbackData, {
        showToast: true,
      });

      if (result.success) {
        Message.success('感谢您的反馈！我们会认真对待每一条意见。');
        form.resetFields();
        setScreenshotPreview(null);
        setScreenshotName('');
        setQuickFeedback(null);
        onSuccess?.();
      }
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      Message.error('提交失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  }, [form, screenshotPreview, screenshotName, getEnvironmentInfo, onSuccess]);

  // Feedback type options
  const feedbackTypeOptions = [
    {
      label: (
        <Space>
          <IconBug />
          Bug 报告
        </Space>
      ),
      value: 'bug',
    },
    {
      label: (
        <Space>
          <IconBulb />
          功能建议
        </Space>
      ),
      value: 'suggestion',
    },
    {
      label: (
        <Space>
          <IconMessage />
          其他
        </Space>
      ),
      value: 'other',
    },
  ];

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Quick Feedback Section */}
      <div style={{ marginBottom: 24 }}>
        <Title heading={6} style={{ marginBottom: 12 }}>
          快速反馈
        </Title>
        <Space size="large">
          <Button
            type={quickFeedback === 'like' ? 'primary' : 'secondary'}
            icon={<span style={{ fontSize: 18 }}>👍</span>}
            onClick={() => handleQuickFeedback('like')}
          >
            很好用！
          </Button>
          <Button
            type={quickFeedback === 'dislike' ? 'primary' : 'secondary'}
            icon={<span style={{ fontSize: 18 }}>👎</span>}
            onClick={() => handleQuickFeedback('dislike')}
            style={quickFeedback === 'dislike' ? { background: '#f53f3f', borderColor: '#f53f3f' } : {}}
          >
            需要改进
          </Button>
        </Space>
      </div>

      <Divider />

      {/* Detailed Feedback Form */}
      <Form
        form={form}
        layout="vertical"
        initialValues={{ type: 'suggestion' }}
      >
        <FormItem
          label="反馈类型"
          field="type"
          rules={[{ required: true, message: '请选择反馈类型' }]}
        >
          <Radio.Group>
            {feedbackTypeOptions.map((option) => (
              <Radio key={option.value} value={option.value}>
                {option.label}
              </Radio>
            ))}
          </Radio.Group>
        </FormItem>

        <FormItem
          label="详细描述"
          field="description"
          rules={[
            { required: true, message: '请描述您的问题或建议' },
            { minLength: 5, message: '请至少输入 5 个字符' },
          ]}
        >
          <TextArea
            placeholder="请详细描述您遇到的问题或您的建议..."
            autoSize={{ minRows: 4, maxRows: 8 }}
            maxLength={2000}
            showWordLimit
          />
        </FormItem>

        {/* Screenshot Upload */}
        <FormItem label="截图（可选）">
          {screenshotPreview ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img
                src={screenshotPreview}
                alt="Screenshot preview"
                style={{
                  maxWidth: '100%',
                  maxHeight: 200,
                  borderRadius: 4,
                  border: '1px solid var(--color-border)',
                }}
              />
              <Button
                type="primary"
                status="danger"
                size="mini"
                icon={<IconDelete />}
                onClick={handleRemoveScreenshot}
                style={{
                  position: 'absolute',
                  top: 8,
                  right: 8,
                }}
              />
              <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                {screenshotName}
              </Text>
            </div>
          ) : (
            <Upload
              accept="image/*"
              limit={1}
              showUploadList={false}
              onChange={(_, fileList) => handleScreenshotChange(fileList)}
              draggable
              style={{
                border: '1px dashed var(--color-border)',
                borderRadius: 4,
                padding: 16,
              }}
            >
              <div style={{ textAlign: 'center', color: 'var(--color-text-3)' }}>
                <IconCamera style={{ fontSize: 32, marginBottom: 8 }} />
                <div>点击或拖拽上传截图</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>支持 JPG, PNG, GIF 格式</div>
              </div>
            </Upload>
          )}
        </FormItem>

        {/* Contact Info (Optional) */}
        <FormItem
          label="联系方式（可选）"
          field="contactInfo"
          extra="如果您希望我们回复，请留下联系方式"
        >
          <Input placeholder="邮箱或手机号" />
        </FormItem>

        {/* Environment Info Notice */}
        <div
          style={{
            background: 'var(--color-fill-1)',
            padding: 12,
            borderRadius: 4,
            marginBottom: 16,
          }}
        >
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 提交时会自动收集环境信息（浏览器、页面地址等），帮助我们更好地理解问题
          </Text>
        </div>

        {/* Submit Buttons */}
        <FormItem>
          <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
            <Button onClick={onCancel}>取消</Button>
            <Button
              type="primary"
              onClick={handleSubmit}
              loading={loading}
            >
              提交反馈
            </Button>
          </Space>
        </FormItem>
      </Form>
    </div>
  );
};

export default FeedbackPanel;