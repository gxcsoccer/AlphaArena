/**
 * FeedbackButton - Floating feedback button component
 * 
 * A floating button fixed at the bottom-right corner that opens the feedback panel
 */

import React, { useState, useCallback } from 'react';
import { Button, Drawer, Badge } from '@arco-design/web-react';
import { IconMessage, IconClose } from '@arco-design/web-react/icon';
import FeedbackPanel from './FeedbackPanel';

interface FeedbackButtonProps {
  /** Initial visibility of the button */
  defaultVisible?: boolean;
  /** Custom position offset from bottom */
  bottom?: number;
  /** Custom position offset from right */
  right?: number;
  /** Badge count for unread feedbacks (optional) */
  badgeCount?: number;
}

const FeedbackButton: React.FC<FeedbackButtonProps> = ({
  defaultVisible = true,
  bottom = 24,
  right = 24,
  badgeCount = 0,
}) => {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [buttonVisible, setButtonVisible] = useState(defaultVisible);

  // Open feedback drawer
  const handleOpenDrawer = useCallback(() => {
    setDrawerVisible(true);
  }, []);

  // Close feedback drawer
  const handleCloseDrawer = useCallback(() => {
    setDrawerVisible(false);
  }, []);

  // Handle successful feedback submission
  const handleFeedbackSuccess = useCallback(() => {
    // Close drawer after successful submission
    setTimeout(() => {
      setDrawerVisible(false);
    }, 1500);
  }, []);

  // Floating button styles
  const buttonStyle: React.CSSProperties = {
    position: 'fixed',
    bottom: bottom,
    right: right,
    zIndex: 1000,
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
    borderRadius: '50%',
    width: 56,
    height: 56,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  if (!buttonVisible) {
    return null;
  }

  return (
    <>
      {/* Floating Button */}
      <div style={buttonStyle}>
        <Badge count={badgeCount} dot={badgeCount > 0}>
          <Button
            type="primary"
            shape="circle"
            size="large"
            icon={<IconMessage style={{ fontSize: 24 }} />}
            onClick={handleOpenDrawer}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
            }}
            aria-label="打开反馈面板"
          />
        </Badge>
      </div>

      {/* Feedback Drawer */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <IconMessage />
            <span>用户反馈</span>
          </div>
        }
        visible={drawerVisible}
        placement="right"
        width={420}
        onClose={handleCloseDrawer}
        footer={null}
        closable={true}
        autoFocus={false}
        focusLock={true}
        unmountOnExit={true}
      >
        <FeedbackPanel
          onSuccess={handleFeedbackSuccess}
          onCancel={handleCloseDrawer}
        />
      </Drawer>
    </>
  );
};

export default FeedbackButton;