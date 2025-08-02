import AsyncStorage from '@react-native-async-storage/async-storage';

export interface EmailReceiptData {
  orderId: string;
  email: string;
}

class EmailReceiptService {
  private static instance: EmailReceiptService;
  private baseUrl: string | null = null;
  private apiKey: string | null = null;

  private constructor() {}

  static getInstance(): EmailReceiptService {
    if (!EmailReceiptService.instance) {
      EmailReceiptService.instance = new EmailReceiptService();
    }
    return EmailReceiptService.instance;
  }

  private async ensureConfig() {
    if (this.baseUrl && this.apiKey) return;
    const raw = await AsyncStorage.getItem('payment_service_config');
    if (!raw) return;
    const cfg = JSON.parse(raw);
    this.baseUrl = cfg?.backend?.baseUrl ?? null;
    this.apiKey = cfg?.backend?.apiKey ?? null;
  }

  async sendReceipt(data: EmailReceiptData): Promise<boolean> {
    try {
      await this.ensureConfig();
      if (!this.baseUrl || !this.apiKey) throw new Error('API config missing');

      const res = await fetch(`${this.baseUrl}/api/v1/orders/${data.orderId}/email_receipt`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: data.email }),
      });
      return res.ok;
    } catch (err) {
      console.error('EmailReceiptService.sendReceipt', err);
      return false;
    }
  }
}

export default EmailReceiptService.getInstance();
