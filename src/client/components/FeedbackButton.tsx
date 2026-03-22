/**
 * FeedbackButton - Floating User Feedback Entry Button
 * 
 * A floating button fixed at the bottom-right corner that opens
 * the feedback panel for users to submit bug reports, suggestions, etc.
 */

import React, { useState, useCallback } from 'react';
import { Drawer, Button, Badge, Tooltip } from '@arco-design/web-react';
import { IconMessage, IconCheck } from '@arco-design/web-react/icon';
import FeedbackPanel from './FeedbackPanel';

interface FeedbackButtonProps {
  /** Position from bottom in pixels */
  bottom?: number;
  /** Position from right in pixels */
  right?: number;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  bottom = 80, // Position above AIAssistantButton
  right = 24,
}) => {
  const [visible, setVisible] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const handleOpen = useCallback(() => {
    setVisible(true);
  }, []);

  const handleClose = useCallback(() => {
    setVisible(false);
    setShowSuccess(false);
  }, []);

  const handleSuccess = useCallback(() => {
    setShowSuccess(true);
    // Auto close after showing success
    setTimeout(() => {
      setVisible(false);
      setShowSuccess(false);
    }, 2000);
  }, []);

  return (
    <>
      {/* Floating Button */}
      <Tooltip
        content="用户反馈"
        position="left"
      >
        <div
          style={{
            position: 'fixed',
            right,
            bottom,
            zIndex: 999, // Below AIAssistantButton (zIndex: 1000)
          }}
        >
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={showSuccess ? <IconCheck /> : <IconMessage />}
            onClick={handleOpen}
            style={{
              width: 48,
              height: 48,
              boxShadow: showSuccess 
                ? '0 4px 12px rgba(0, 200, 100, 0.4)' 
                : '0 4px 12px rgba(114, 46, 209, 0.4)',
              background: showSuccess 
                ? 'linear-gradient(135deg, #00c864 0%, #00a64d 100%)' 
                : 'linear-gradient(135deg, #722ed1 0%, #531dab 100%)',
            }}
            aria-label="打开用户反馈"
          />
        </div>
      </Tooltip>

      {/* Feedback Drawer */}
      <Drawer
        title={
          <span>
            <IconMessage style={{ marginRight: 8, color: '#722ed1' }} />
            用户反馈
          </span>
        }
        placement="right"
        width={450}
        visible={visible}
        onCancel={handleClose}
        footer={null}
        unmountOnExit={true}
      >
        <FeedbackPanel 
          onSuccess={handleSuccess}
          onCancel={handleClose}
        />
      </Drawer>
    </>
  );
};

export default FeedbackButton;