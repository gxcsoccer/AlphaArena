/**
 * Price Alert Notification Service
 * 
 * Handles browser push notifications, sound alerts, and in-app notifications
 * for the price alert system.
 */

// Alert sound URL (using a built-in sound or CDN)
const ALERT_SOUND_URL = 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleVMdAMTq2teleUoeAMXr3e7eqkcXAcTu4O/gqkoYAcXv4fDhq0sWAsTw4vHirE0VAsXx5PPjrVAXAsjy5fPkrVIZAsnz5vTlrVQbAsr05vXmrVgeAss15vbnrFohAss25vbnrFskAsw35/borV0mAs056Pbprl8oAs466PfqrmIqAs866vfrrmQsAtE76/jrr2cuAtI87fnssWkxAtM+7vnttGw0AtNA7/nttW42AtRB8PnutXA5AtRC8fnvu3M8AtRE8vnvu3Q9AtRF8vnvu3U+AtRG8vnvu3Y/AtRH8vnvu3dBAtRI8vnvu3JCAtRJ8vnvu3NDAtRK8vnvu3REAtRL8vnvu3VFAtRM8vnvu3ZGAtRN8vnvu3dHAtRO8vnvu3hIAtRP8vnvu3lJAtRQ8vnvu3pKAtRR8vnvu3tLAtRS8vnvu3xMAtRT8vnvu31NAtRU8vnvu35OAtRV8vnvu39PAtRW8vnvvABRAtRX8vnvvQFTAtRY8vnvvgFWAtRZ8vnvvwFYAtRa8vnvwAFbAtRb8vnvwQFdAtRc8vnvwgFfAtRd8vnvwwFhAtRe8vnvwxFjAtRf8vnvxBlmAtRg8vnvxRpoAtRh8vnvxhtsAtRi8vnvxxtuAtRj8vnvyBtwAtRk8vnvyRtzAtRl8vnvyxt2AtRm8vnvzB14AtRn8vnvzR57AtRo8vnvzxt+AtRp8vnv0B2AAtRq8vnv0R2DAtRr8vnv0h2FAtRs8vnv0x2HAtRt8vnv1B2JAtRu8vnv1R2LAtRv8vnv1h2NAtRw8vnv1x2PAtRx8vnv2B2RAtRy8vnv2R2TAtRz8vnv2h2VAtR08vnv2x2XAtR18vnv3B2ZAtR28vnv3R2bAtR38vnv3h2dAtR48vnv3x2fAtR58vnv4B2hAtR68vnv4R2jAtR78vnv4h2lAtR88vnv4x2nAtR98vnv5B2pAtR+8vnv5R2rAtR/8vnv5h2tAtSA8vnv5x2vAtSB8vnv6B2xAtSC8vnv6R2zAtSD8vnv6h21AtSE8vnv6x23AtSF8vnv7B25AtSG8vnv7R27AtSH8vnv7h29AtSI8vnv7x2/AtSJ8vnv8B3BAtSK8vnv8R3DAtSL8vnv8h3FAtSM8vnv8x3HAtSN8vnv9B3JAtSO8vnv9R3LAtSP8vnv9h3NAtSQ8vnv9x3PAtSR8vnv+B3RAtSS8vnv+R3TAtST8vnv+h3VAtSU8vnv+x3XAtSV8vnv/B3ZAtSW8vnv/R3bAtSX8vnv/h3dAtSY8vnv/x3fAtSZ8vnAAB3hAtSa8vnAAB3jAtSb8vnABR3lAtSc8vnABh3nAtSd8vnABx3pAtSe8vnACB3rAtSf8vnACR3tAtSg8vnACh3vAtSh8vnACx3xAtSi8vnADB3zAtSj8vnADR31AtSk8vnADh33AtSl8vnADx35AtSm8vM=';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: any;
  requireInteraction?: boolean;
  silent?: boolean;
}

export interface PriceAlertNotification {
  id: string;
  type: 'triggered' | 'created' | 'deleted' | 'error';
  title: string;
  message: string;
  symbol: string;
  targetPrice: number;
  triggeredPrice?: number;
  conditionType: 'above' | 'below';
  timestamp: Date;
  read: boolean;
}

class NotificationService {
  private permission: NotificationPermission = 'default';
  private audioContext: AudioContext | null = null;
  private audioElement: HTMLAudioElement | null = null;
  private soundEnabled: boolean = true;
  private notificationsEnabled: boolean = true;
  private notificationHistory: PriceAlertNotification[] = [];
  private listeners: Set<(notifications: PriceAlertNotification[]) => void> = new Set();

  constructor() {
    this.init();
  }

  private async init() {
    // Check notification permission
    if (typeof window !== 'undefined' && 'Notification' in window) {
      this.permission = Notification.permission;
      
      // Request permission if not yet determined
      if (this.permission === 'default') {
        // Don't auto-request - wait for user interaction
      }
    }

    // Initialize audio
    this.initAudio();
    
    // Load notification history from localStorage
    this.loadHistory();
  }

  private initAudio() {
    if (typeof window === 'undefined') return;
    
    // Create audio element for alert sound
    this.audioElement = new Audio(ALERT_SOUND_URL);
    this.audioElement.volume = 0.5;
    this.audioElement.preload = 'auto';
  }

  private loadHistory() {
    if (typeof window === 'undefined') return;
    
    try {
      const stored = localStorage.getItem('price-alert-notifications');
      if (stored) {
        this.notificationHistory = JSON.parse(stored).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp),
        }));
      }
    } catch (e) {
      console.error('[NotificationService] Failed to load history:', e);
    }
  }

  private saveHistory() {
    if (typeof window === 'undefined') return;
    
    try {
      // Keep only last 100 notifications
      const toStore = this.notificationHistory.slice(0, 100);
      localStorage.setItem('price-alert-notifications', JSON.stringify(toStore));
    } catch (e) {
      console.error('[NotificationService] Failed to save history:', e);
    }
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener([...this.notificationHistory]));
  }

  /**
   * Request notification permission
   */
  async requestPermission(): Promise<NotificationPermission> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      console.warn('[NotificationService] Notifications not supported');
      return 'denied';
    }

    if (Notification.permission === 'granted') {
      this.permission = 'granted';
      return 'granted';
    }

    if (Notification.permission === 'denied') {
      this.permission = 'denied';
      return 'denied';
    }

    try {
      this.permission = await Notification.requestPermission();
      return this.permission;
    } catch (e) {
      console.error('[NotificationService] Failed to request permission:', e);
      return 'denied';
    }
  }

  /**
   * Get current permission status
   */
  getPermissionStatus(): NotificationPermission {
    return this.permission;
  }

  /**
   * Check if notifications are supported
   */
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Enable/disable sound alerts
   */
  setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled;
    localStorage.setItem('price-alert-sound-enabled', String(enabled));
  }

  /**
   * Get sound enabled status
   */
  isSoundEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    
    const stored = localStorage.getItem('price-alert-sound-enabled');
    if (stored !== null) {
      return stored === 'true';
    }
    return this.soundEnabled;
  }

  /**
   * Enable/disable notifications
   */
  setNotificationsEnabled(enabled: boolean) {
    this.notificationsEnabled = enabled;
    localStorage.setItem('price-alert-notifications-enabled', String(enabled));
  }

  /**
   * Get notifications enabled status
   */
  isNotificationsEnabled(): boolean {
    if (typeof window === 'undefined') return false;
    
    const stored = localStorage.getItem('price-alert-notifications-enabled');
    if (stored !== null) {
      return stored === 'true';
    }
    return this.notificationsEnabled;
  }

  /**
   * Play alert sound
   */
  async playAlertSound(): Promise<void> {
    if (!this.soundEnabled) return;
    
    try {
      // Try using audio element first
      if (this.audioElement) {
        this.audioElement.currentTime = 0;
        await this.audioElement.play();
        return;
      }

      // Fallback to Web Audio API
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);

      oscillator.start(this.audioContext.currentTime);
      oscillator.stop(this.audioContext.currentTime + 0.5);
    } catch (e) {
      console.error('[NotificationService] Failed to play sound:', e);
    }
  }

  /**
   * Show browser notification
   */
  async showNotification(options: NotificationOptions): Promise<Notification | null> {
    if (!this.notificationsEnabled) return null;
    if (this.permission !== 'granted') {
      await this.requestPermission();
      if (this.permission !== 'granted') return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        badge: options.badge || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        if (options.data?.onClick) {
          options.data.onClick();
        }
      };

      return notification;
    } catch (e) {
      console.error('[NotificationService] Failed to show notification:', e);
      return null;
    }
  }

  /**
   * Show price alert triggered notification
   */
  async showAlertTriggered(alert: {
    id: string;
    symbol: string;
    conditionType: 'above' | 'below';
    targetPrice: number;
    triggeredPrice?: number;
  }): Promise<void> {
    const conditionText = alert.conditionType === 'above' ? '高于' : '低于';
    const title = `💰 ${alert.symbol} 价格提醒触发`;
    const body = `${alert.symbol} 当前价格已${conditionText}目标价格 $${alert.targetPrice.toLocaleString()}`;
    
    // Create notification record
    const notification: PriceAlertNotification = {
      id: `alert-${alert.id}-${Date.now()}`,
      type: 'triggered',
      title,
      message: body,
      symbol: alert.symbol,
      targetPrice: alert.targetPrice,
      triggeredPrice: alert.triggeredPrice,
      conditionType: alert.conditionType,
      timestamp: new Date(),
      read: false,
    };

    // Add to history
    this.notificationHistory.unshift(notification);
    this.saveHistory();
    this.notifyListeners();

    // Show browser notification
    await this.showNotification({
      title,
      body,
      tag: `price-alert-${alert.id}`,
      data: {
        alertId: alert.id,
        symbol: alert.symbol,
      },
      requireInteraction: true,
    });

    // Play sound
    await this.playAlertSound();
  }

  /**
   * Get notification history
   */
  getHistory(): PriceAlertNotification[] {
    return [...this.notificationHistory];
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.notificationHistory.filter(n => !n.read).length;
  }

  /**
   * Mark notification as read
   */
  markAsRead(notificationId: string): void {
    const notification = this.notificationHistory.find(n => n.id === notificationId);
    if (notification) {
      notification.read = true;
      this.saveHistory();
      this.notifyListeners();
    }
  }

  /**
   * Mark all as read
   */
  markAllAsRead(): void {
    this.notificationHistory.forEach(n => n.read = true);
    this.saveHistory();
    this.notifyListeners();
  }

  /**
   * Clear all notifications
   */
  clearAll(): void {
    this.notificationHistory = [];
    this.saveHistory();
    this.notifyListeners();
  }

  /**
   * Subscribe to notification changes
   */
  subscribe(listener: (notifications: PriceAlertNotification[]) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

// Singleton instance
let notificationServiceInstance: NotificationService | null = null;

export function getNotificationService(): NotificationService {
  if (!notificationServiceInstance) {
    notificationServiceInstance = new NotificationService();
  }
  return notificationServiceInstance;
}

export default NotificationService;
