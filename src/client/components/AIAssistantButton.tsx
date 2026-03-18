/**
 * AIAssistantButton - Floating AI Assistant Entry Button
 * A floating button that opens the AI Strategy Assistant panel
 */

import React, { useState } from 'react';
import { Drawer, Button } from '@arco-design/web-react';
import { IconBulb } from '@arco-design/web-react/icon';
import AIAssistantPanel from './AIAssistantPanel';

const AIAssistantButton: React.FC = () => {
  const [visible, setVisible] = useState(false);

  return (
    <>
      {/* Floating Button */}
      <Button
        type="primary"
        shape="circle"
        size="large"
        icon={<IconBulb />}
        onClick={() => setVisible(true)}
        style={{
          position: 'fixed',
          right: 24,
          bottom: 24,
          width: 56,
          height: 56,
          zIndex: 1000,
          boxShadow: '0 4px 12px rgba(22, 93, 255, 0.4)',
        }}
        aria-label="Open AI Strategy Assistant"
      />

      {/* AI Assistant Drawer */}
      <Drawer
        title={
          <span>
            <IconBulb style={{ marginRight: 8, color: '#165dff' }} />
            AI 策略助手
          </span>
        }
        placement="right"
        width={450}
        visible={visible}
        onCancel={() => setVisible(false)}
        footer={null}
        unmountOnExit={false}
      >
        <AIAssistantPanel />
      </Drawer>
    </>
  );
};

export default AIAssistantButton;
