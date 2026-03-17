/**
 * NotificationSettings Component
 * User preferences for notification delivery
 */

import React, { useEffect, useState } from 'react';
import {
  Card,
  Form,
  Switch,
  Select,
  TimePicker,
  Typography,
  Divider,
  Message,
  Space,
  Button,
} from '@arco-design/web-react';
import { IconCheck, IconPushpin, IconMail, IconDesktop } from '@arco-design/web-react/icon';
import './NotificationSettings.css';
import { useNotifications } from '../hooks/useNotifications.js';
import type { NotificationPreferences } from '../hooks/useNotifications.js';

const { Title, Text } = Typography;
const FormItem = Form.Item;

const NotificationSettings: React.FC = () => {
  const { preferences, loading, updatePreferences, requestBrowserPermission } = useNotifications();
  const [form] = Form.useForm();
  const [saving, setSaving] = useState(false);

  // Initialize form with preferences
  useEffect(() => {
    if (preferences) {
      form.setFieldsValue({
        in_app_enabled: preferences.in_app_enabled,
        email_enabled: preferences.email_enabled,
        push_enabled: preferences.push_enabled,
        signal_notifications: preferences.signal_notifications,
        risk_notifications: preferences.risk_notifications,
        performance_notifications: preferences.performance_notifications,
        system_notifications: preferences.system_notifications,
        priority_threshold: preferences.priority_threshold,
        quiet_hours_enabled: preferences.quiet_hours_enabled,
        quiet_hours_start: preferences.quiet_hours_start || '22:00',
        quiet_hours_end: preferences.quiet_hours_end || '08:00',
        digest_enabled: preferences.digest_enabled,
        digest_frequency: preferences.digest_frequency || 'daily',
      });
    }
  }, [preferences, form]);

  const handleSave = async (values: Partial<NotificationPreferences>) => {
    setSaving(true);
    try {
      await updatePreferences(values);
      Message.success('Notification preferences saved');
    } catch (err) {
      Message.error('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    const granted = await requestBrowserPermission();
    if (granted) {
      Message.success('Browser notifications enabled');
      await updatePreferences({ push_enabled: true });
      form.setFieldValue('push_enabled', true);
    } else {
      Message.warning('Browser notification permission denied. Please enable in browser settings.');
    }
  };

  if (loading && !preferences) {
    return (
      <Card loading>
        <div style={{ height: 400 }} />
      </Card>
    );
  }

  return (
    <Card>
      <Title heading={5}>Notification Preferences</Title>
      <Text type="secondary">
        Configure how and when you receive notifications
      </Text>

      <Divider />

      <Form
        form={form}
        layout="vertical"
        onSubmit={handleSave}
        initialValues={{
          in_app_enabled: true,
          email_enabled: false,
          push_enabled: false,
          signal_notifications: true,
          risk_notifications: true,
          performance_notifications: true,
          system_notifications: true,
          priority_threshold: 'LOW',
          quiet_hours_enabled: false,
          quiet_hours_start: '22:00',
          quiet_hours_end: '08:00',
          digest_enabled: false,
          digest_frequency: 'daily',
        }}
      >
        {/* Delivery Channels */}
        <Title heading={6}>Delivery Channels</Title>
        
        <FormItem label="In-App Notifications" field="in_app_enabled" triggerPropName="checked">
          <Switch />
        </FormItem>

        <FormItem label="Email Notifications" field="email_enabled" triggerPropName="checked">
          <Switch />
        </FormItem>

        <FormItem 
          label={
            <Space>
              Browser Push Notifications
              <Button type="primary" size="small" onClick={handleEnablePush}>
                Enable Browser Notifications
              </Button>
            </Space>
          } 
          field="push_enabled" 
          triggerPropName="checked"
        >
          <Switch />
        </FormItem>

        <Divider />

        {/* Notification Types */}
        <Title heading={6}>Notification Types</Title>
        
        <FormItem label="Trading Signals" field="signal_notifications" triggerPropName="checked">
          <Switch />
        </FormItem>
        <Text type="secondary" style={{ marginTop: -16, marginBottom: 16, display: 'block' }}>
          Receive notifications when strategies generate buy/sell signals
        </Text>

        <FormItem label="Risk Alerts" field="risk_notifications" triggerPropName="checked">
          <Switch />
        </FormItem>
        <Text type="secondary" style={{ marginTop: -16, marginBottom: 16, display: 'block' }}>
          Get alerted when position limits or loss thresholds are exceeded
        </Text>

        <FormItem label="Performance Reports" field="performance_notifications" triggerPropName="checked">
          <Switch />
        </FormItem>
        <Text type="secondary" style={{ marginTop: -16, marginBottom: 16, display: 'block' }}>
          Receive daily/weekly performance summaries
        </Text>

        <FormItem label="System Notifications" field="system_notifications" triggerPropName="checked">
          <Switch />
        </FormItem>
        <Text type="secondary" style={{ marginTop: -16, marginBottom: 16, display: 'block' }}>
          Platform updates, maintenance notices, and system alerts
        </Text>

        <Divider />

        {/* Priority Settings */}
        <Title heading={6}>Priority Settings</Title>
        
        <FormItem 
          label="Minimum Priority Level" 
          field="priority_threshold"
        >
          <Select style={{ width: 200 }}>
            <Select.Option value="LOW">All notifications</Select.Option>
            <Select.Option value="MEDIUM">Medium and above</Select.Option>
            <Select.Option value="HIGH">High and urgent only</Select.Option>
            <Select.Option value="URGENT">Urgent only</Select.Option>
          </Select>
        </FormItem>

        <Divider />

        {/* Quiet Hours */}
        <Title heading={6}>Quiet Hours</Title>
        <Text type="secondary">
          Pause notifications during specific hours
        </Text>

        <FormItem label="Enable Quiet Hours" field="quiet_hours_enabled" triggerPropName="checked" style={{ marginTop: 16 }}>
          <Switch />
        </FormItem>

        <Form.Item shouldUpdate noStyle>
          {(fields) => {
            const quietHoursEnabled = fields.quiet_hours_enabled;
            return quietHoursEnabled ? (
              <Space size="large">
                <FormItem label="Start Time" field="quiet_hours_start">
                  <TimePicker
                    format="HH:mm"
                    style={{ width: 120 }}
                  />
                </FormItem>
                <FormItem label="End Time" field="quiet_hours_end">
                  <TimePicker
                    format="HH:mm"
                    style={{ width: 120 }}
                  />
                </FormItem>
              </Space>
            ) : null;
          }}
        </Form.Item>

        <Divider />

        {/* Digest Mode */}
        <Title heading={6}>Digest Mode</Title>
        <Text type="secondary">
          Bundle multiple notifications into periodic summaries
        </Text>

        <FormItem label="Enable Digest" field="digest_enabled" triggerPropName="checked" style={{ marginTop: 16 }}>
          <Switch />
        </FormItem>

        <Form.Item shouldUpdate noStyle>
          {(fields) => {
            const digestEnabled = fields.digest_enabled;
            return digestEnabled ? (
              <FormItem label="Digest Frequency" field="digest_frequency">
                <Select style={{ width: 200 }}>
                  <Select.Option value="hourly">Every hour</Select.Option>
                  <Select.Option value="daily">Daily</Select.Option>
                  <Select.Option value="weekly">Weekly</Select.Option>
                </Select>
              </FormItem>
            ) : null;
          }}
        </Form.Item>

        <Divider />

        <FormItem>
          <Button type="primary" htmlType="submit" loading={saving}>
            Save Preferences
          </Button>
        </FormItem>
      </Form>
    </Card>
  );
};

export default NotificationSettings;
