/**
 * Privacy Settings Page
 *
 * @module pages/PrivacySettingsPage
 * @description GDPR-compliant privacy settings page for data export and deletion
 */

import React, { useState, useEffect } from 'react';
import {
  Card,
  Button,
  Typography,
  Space,
  Message,
  Modal,
  Input,
  Spin,
  List,
  Tag,
  Collapse,
  Alert,
  Descriptions,
  Divider,
  Empty,
} from '@arco-design/web-react';
import {
  IconDownload,
  IconDelete,
  IconExclamationCircle,
  IconInfoCircle,
  IconCheck,
  IconClose,
  IconHistory,
  IconLock,
  IconStorage,
} from '@arco-design/web-react/icon';
import { useNavigate } from 'react-router-dom';

const { Title, Text, Paragraph } = Typography;
const CollapseItem = Collapse.Item;

interface DataSummary {
  profile: boolean;
  sessions: number;
  strategies: number;
  trades: number;
  portfolios: number;
  subscriptions: number;
  payments: number;
  notifications: number;
  preferences: boolean;
  referrals: number;
  feedback: number;
  exchangeAccounts: number;
  apiKeys: number;
  auditLogs: number;
  totalRecords: number;
}

interface ExportRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  format: 'json' | 'csv';
  requested_at: string;
  completed_at?: string;
  download_url?: string;
  expires_at?: string;
  error_message?: string;
}

interface DeletionRequest {
  id: string;
  user_id: string;
  status: 'pending' | 'confirmed' | 'processing' | 'completed' | 'cancelled';
  confirmation_code?: string;
  requested_at: string;
  confirmed_at?: string;
  scheduled_deletion_at?: string;
  completed_at?: string;
  cancelled_at?: string;
}

const PrivacySettingsPage: React.FC = () => {
  const navigate = useNavigate();
  
  // State
  const [dataSummary, setDataSummary] = useState<DataSummary | null>(null);
  const [exportHistory, setExportHistory] = useState<ExportRequest[]>([]);
  const [deletionRequest, setDeletionRequest] = useState<DeletionRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmationCode, setConfirmationCode] = useState('');
  const [deleteRequestId, setDeleteRequestId] = useState<string | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchData();
  }, []);

  const getToken = () => localStorage.getItem('token');

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = getToken();
      
      // Fetch data summary
      const summaryRes = await fetch('/api/gdpr/data-summary', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (summaryRes.ok) {
        const summaryData = await summaryRes.json();
        setDataSummary(summaryData.data);
      }

      // Fetch export history
      const historyRes = await fetch('/api/gdpr/export/history', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setExportHistory(historyData.data || []);
      }

      // Fetch deletion status
      const deletionRes = await fetch('/api/gdpr/delete-status', {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (deletionRes.ok) {
        const deletionData = await deletionRes.json();
        setDeletionRequest(deletionData.data);
      }
    } catch (err) {
      Message.error('Failed to load privacy data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const token = getToken();

      const res = await fetch('/api/gdpr/export', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format: 'json' }),
      });

      const data = await res.json();

      if (data.success) {
        // Trigger download
        window.location.href = `/api/gdpr/export/${data.data.exportId}/download?token=${token}`;
        Message.success('Data export started. Download will begin shortly.');
        fetchData();
      } else {
        Message.error(data.error || 'Failed to export data');
      }
    } catch (err) {
      Message.error('Failed to export data');
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteRequest = async () => {
    try {
      const token = getToken();
      
      const res = await fetch('/api/gdpr/delete-request', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await res.json();

      if (data.success) {
        setDeleteRequestId(data.data.requestId);
        setShowDeleteModal(false);
        setShowConfirmModal(true);
        Message.success(data.data.message);
        fetchData();
      } else {
        Message.error(data.error || 'Failed to request deletion');
      }
    } catch (err) {
      Message.error('Failed to request deletion');
    }
  };

  const handleConfirmDeletion = async () => {
    try {
      const token = getToken();
      
      const res = await fetch('/api/gdpr/delete-confirm', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: deleteRequestId,
          confirmationCode,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setShowConfirmModal(false);
        Message.success(data.data.message);
        fetchData();
      } else {
        Message.error(data.error || 'Invalid confirmation code');
      }
    } catch (err) {
      Message.error('Failed to confirm deletion');
    }
  };

  const handleCancelDeletion = async () => {
    try {
      const token = getToken();
      
      const res = await fetch('/api/gdpr/delete-cancel', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: deletionRequest?.id,
        }),
      });

      const data = await res.json();

      if (data.success) {
        Message.success('Account deletion request cancelled successfully.');
        fetchData();
      } else {
        Message.error(data.error || 'Failed to cancel deletion');
      }
    } catch (err) {
      Message.error('Failed to cancel deletion');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusColor = (status: string): 'green' | 'orange' | 'arcoblue' | 'red' | 'gray' => {
    switch (status) {
      case 'completed':
        return 'green';
      case 'pending':
        return 'orange';
      case 'processing':
        return 'arcoblue';
      case 'failed':
      case 'cancelled':
        return 'red';
      default:
        return 'gray';
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Spin size={40} />
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: 24 }}>
      <Title heading={4}>Privacy Settings</Title>
      <Text type="secondary">Manage your personal data in accordance with GDPR regulations.</Text>

      {/* Deletion Warning Banner */}
      {deletionRequest && deletionRequest.status === 'confirmed' && (
        <Alert
          type="warning"
          icon={<IconExclamationCircle />}
          content={
            <Space direction="vertical" size="small">
              <Text>
                Your account is scheduled for deletion on{' '}
                {deletionRequest.scheduled_deletion_at && formatDate(deletionRequest.scheduled_deletion_at)}.
                You can cancel this request before then.
              </Text>
              <Button size="small" onClick={handleCancelDeletion}>
                Cancel Deletion
              </Button>
            </Space>
          }
          style={{ marginBottom: 16, marginTop: 16 }}
        />
      )}

      {/* Data Summary */}
      <Card style={{ marginBottom: 16, marginTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconStorage style={{ marginRight: 8, fontSize: 20 }} />
          <Title heading={5} style={{ margin: 0 }}>Your Data Summary</Title>
        </div>

        {dataSummary ? (
          <div>
            <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
              Total records stored: <strong>{dataSummary.totalRecords}</strong>
            </Text>

            <Collapse accordion>
              <CollapseItem header="View detailed breakdown" name="details">
                <List size="small" bordered={false}>
                  {dataSummary.profile && (
                    <List.Item
                      actions={[<Tag color="green" key="status">Active</Tag>]}
                    >
                      Profile Information - Your basic account details
                    </List.Item>
                  )}
                  {dataSummary.sessions > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.sessions}</Tag>]}
                    >
                      Sessions - Active sessions
                    </List.Item>
                  )}
                  {dataSummary.strategies > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.strategies}</Tag>]}
                    >
                      Strategies - Trading strategies
                    </List.Item>
                  )}
                  {dataSummary.trades > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.trades}</Tag>]}
                    >
                      Trades - Trade records
                    </List.Item>
                  )}
                  {dataSummary.subscriptions > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.subscriptions}</Tag>]}
                    >
                      Subscriptions - Subscription records
                    </List.Item>
                  )}
                  {dataSummary.payments > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.payments}</Tag>]}
                    >
                      Payments - Payment records
                    </List.Item>
                  )}
                  {dataSummary.apiKeys > 0 && (
                    <List.Item
                      actions={[<Tag key="count">{dataSummary.apiKeys}</Tag>]}
                    >
                      API Keys - API key configurations
                    </List.Item>
                  )}
                </List>
              </CollapseItem>
            </Collapse>
          </div>
        ) : (
          <Empty description="No data available" />
        )}
      </Card>

      {/* Data Export */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconDownload style={{ marginRight: 8, fontSize: 20 }} />
          <Title heading={5} style={{ margin: 0 }}>Export Your Data</Title>
        </div>

        <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          Download a copy of all your personal data in a machine-readable format (JSON).
        </Text>

        <Button
          type="primary"
          icon={exporting ? <IconCheck /> : <IconDownload />}
          loading={exporting}
          onClick={handleExport}
          disabled={deletionRequest?.status === 'confirmed'}
        >
          {exporting ? 'Exporting...' : 'Export Data'}
        </Button>

        {/* Export History */}
        {exportHistory.length > 0 && (
          <div style={{ marginTop: 16 }}>
            <Text bold style={{ marginBottom: 8, display: 'block' }}>
              <IconHistory style={{ marginRight: 4 }} />
              Export History
            </Text>
            <List size="small" bordered>
              {exportHistory.slice(0, 5).map((item) => (
                <List.Item
                  key={item.id}
                  actions={[
                    item.status === 'completed' && (
                      <Button
                        key="download"
                        size="small"
                        onClick={() => {
                          window.location.href = `/api/gdpr/export/${item.id}/download?token=${getToken()}`;
                        }}
                      >
                        Download
                      </Button>
                    ),
                    <Tag key="status" color={getStatusColor(item.status)}>
                      {item.status}
                    </Tag>,
                  ]}
                >
                  <List.Item.Meta
                    title={formatDate(item.requested_at)}
                    description={`${item.format.toUpperCase()} format`}
                  />
                </List.Item>
              ))}
            </List>
          </div>
        )}
      </Card>

      {/* Data Deletion */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconDelete style={{ marginRight: 8, fontSize: 20, color: 'rgb(var(--danger-6))' }} />
          <Title heading={5} style={{ margin: 0, color: 'rgb(var(--danger-6))' }}>
            Delete Your Data
          </Title>
        </div>

        <Alert
          type="warning"
          content={
            <Text>
              <strong>Warning:</strong> This action is irreversible. After confirming deletion, 
              your account will be permanently deleted after a 30-day cooling-off period.
            </Text>
          }
          style={{ marginBottom: 12 }}
        />

        <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          When you request account deletion:
        </Text>

        <List size="small" bordered={false}>
          <List.Item>
            <IconInfoCircle style={{ marginRight: 8, color: 'rgb(var(--primary-6))' }} />
            A confirmation code will be sent to your email
          </List.Item>
          <List.Item>
            <IconInfoCircle style={{ marginRight: 8, color: 'rgb(var(--primary-6))' }} />
            After confirmation, you have 30 days to cancel
          </List.Item>
          <List.Item>
            <IconInfoCircle style={{ marginRight: 8, color: 'rgb(var(--primary-6))' }} />
            After 30 days, all your data will be permanently deleted
          </List.Item>
          <List.Item>
            <IconInfoCircle style={{ marginRight: 8, color: 'rgb(var(--primary-6))' }} />
            Some data (financial records) may be retained for legal compliance
          </List.Item>
        </List>

        {deletionRequest ? (
          <div style={{ marginTop: 16 }}>
            <Text bold>Current Request Status:</Text>
            <div style={{ marginTop: 8 }}>
              <Tag color={getStatusColor(deletionRequest.status)} style={{ marginRight: 8 }}>
                {deletionRequest.status}
              </Tag>
            </div>
            
            {deletionRequest.status === 'pending' && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Check your email for the confirmation code.
              </Text>
            )}
            
            {deletionRequest.status === 'confirmed' && deletionRequest.scheduled_deletion_at && (
              <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                Scheduled deletion: {formatDate(deletionRequest.scheduled_deletion_at)}
              </Text>
            )}
          </div>
        ) : (
          <Button
            status="danger"
            icon={<IconDelete />}
            onClick={() => setShowDeleteModal(true)}
            style={{ marginTop: 16 }}
          >
            Request Account Deletion
          </Button>
        )}
      </Card>

      {/* Privacy Information */}
      <Card>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 16 }}>
          <IconLock style={{ marginRight: 8, fontSize: 20 }} />
          <Title heading={5} style={{ margin: 0 }}>Privacy Information</Title>
        </div>

        <Text type="secondary" style={{ marginBottom: 12, display: 'block' }}>
          Your privacy is important to us. Here's how we handle your data:
        </Text>

        <List size="small" bordered={false}>
          <List.Item>
            <IconCheck style={{ marginRight: 8, color: 'rgb(var(--success-6))' }} />
            All data is encrypted in transit and at rest
          </List.Item>
          <List.Item>
            <IconCheck style={{ marginRight: 8, color: 'rgb(var(--success-6))' }} />
            We never sell your personal data to third parties
          </List.Item>
          <List.Item>
            <IconCheck style={{ marginRight: 8, color: 'rgb(var(--success-6))' }} />
            You have the right to access, correct, and delete your data
          </List.Item>
          <List.Item>
            <IconCheck style={{ marginRight: 8, color: 'rgb(var(--success-6))' }} />
            Data retention policies comply with GDPR requirements
          </List.Item>
        </List>

        <Divider />

        <Text type="secondary">
          For questions about your privacy, contact us at{' '}
          <a href="mailto:privacy@alphaarena.com">privacy@alphaarena.com</a>
        </Text>
      </Card>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Request Account Deletion"
        visible={showDeleteModal}
        onCancel={() => setShowDeleteModal(false)}
        onOk={handleDeleteRequest}
        okText="Request Deletion"
        okButtonProps={{ status: 'danger' }}
        unmountOnExit
      >
        <Alert
          type="warning"
          content="This will initiate the account deletion process."
          style={{ marginBottom: 16 }}
        />
        <Text>
          A confirmation code will be sent to your email. You must enter this code to confirm the deletion request.
          After confirmation, you have 30 days to cancel before your data is permanently deleted.
        </Text>
      </Modal>

      {/* Confirmation Code Modal */}
      <Modal
        title="Confirm Deletion"
        visible={showConfirmModal}
        onCancel={() => setShowConfirmModal(false)}
        onOk={handleConfirmDeletion}
        okText="Confirm Deletion"
        okButtonProps={{ status: 'danger', disabled: confirmationCode.length !== 6 }}
        unmountOnExit
      >
        <Text style={{ marginBottom: 12, display: 'block' }}>
          Enter the 6-digit confirmation code sent to your email:
        </Text>
        <Input
          placeholder="Enter 6-digit code"
          maxLength={6}
          value={confirmationCode}
          onChange={setConfirmationCode}
          style={{ fontSize: 18, letterSpacing: 4, textAlign: 'center' }}
        />
      </Modal>
    </div>
  );
};

export default PrivacySettingsPage;