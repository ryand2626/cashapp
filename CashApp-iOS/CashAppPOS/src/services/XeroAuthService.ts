import { Linking } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';
import CryptoJS from 'crypto-js';
import * as Keychain from 'react-native-keychain';

export interface XeroTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  tenant_id?: string;
  scopes: string[];
}

export interface XeroConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  baseUrl: string;
}

export class XeroAuthService {
  private static instance: XeroAuthService;
  private config: XeroConfig;
  private readonly KEYCHAIN_SERVICE = 'FynloPOS_Xero';
  private readonly STORAGE_KEY = 'xero_integration_settings';

  private constructor() {
    // Default configuration - should be moved to environment variables
    this.config = {
      clientId: process.env.XERO_CLIENT_ID || 'YOUR_XERO_CLIENT_ID',
      clientSecret: process.env.XERO_CLIENT_SECRET || 'YOUR_XERO_CLIENT_SECRET',
      redirectUri: 'fynlopos://oauth/xero/callback',
      scopes: [
        'accounting.transactions',
        'accounting.contacts.read',
        'accounting.settings.read',
        'accounting.reports.read',
      ],
      baseUrl: 'https://api.xero.com',
    };
  }

  public static getInstance(): XeroAuthService {
    if (!XeroAuthService.instance) {
      XeroAuthService.instance = new XeroAuthService();
    }
    return XeroAuthService.instance;
  }

  /**
   * Generate OAuth 2.0 authorization URL with PKCE
   */
  public async generateAuthUrl(): Promise<{
    authUrl: string;
    codeVerifier: string;
    state: string;
  }> {
    try {
      // Generate PKCE code verifier and challenge
      const codeVerifier = this.generateCodeVerifier();
      const codeChallenge = this.generateCodeChallenge(codeVerifier);
      const state = this.generateRandomString(32);

      // Store code verifier and state securely
      await this.storeSecureValue('pkce_code_verifier', codeVerifier);
      await this.storeSecureValue('oauth_state', state);

      const params = new URLSearchParams({
        response_type: 'code',
        client_id: this.config.clientId,
        redirect_uri: this.config.redirectUri,
        scope: this.config.scopes.join(' '),
        state,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      });

      const authUrl = `https://login.xero.com/identity/connect/authorize?${params.toString()}`;

      return { authUrl, codeVerifier, state };
    } catch (error) {
      console.error('Error generating auth URL:', error);
      throw new Error('Failed to generate authorization URL');
    }
  }

  /**
   * Exchange authorization code for access tokens
   */
  public async exchangeCodeForTokens(code: string, state: string): Promise<XeroTokens> {
    try {
      // Verify state parameter
      const storedState = await this.getSecureValue('oauth_state');
      if (state !== storedState) {
        throw new Error('Invalid state parameter');
      }

      // Retrieve code verifier
      const codeVerifier = await this.getSecureValue('pkce_code_verifier');
      if (!codeVerifier) {
        throw new Error('Code verifier not found');
      }

      const tokenData = {
        grant_type: 'authorization_code',
        client_id: this.config.clientId,
        code,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier,
      };

      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.getBasicAuthHeader()}`,
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        throw new Error(`Token exchange failed: ${response.status}`);
      }

      const tokens = await response.json();

      const xeroTokens: XeroTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        scopes: tokens.scope?.split(' ') || this.config.scopes,
      };

      // Store tokens securely
      await this.storeTokens(xeroTokens);

      // Clean up temporary storage
      await this.removeSecureValue('pkce_code_verifier');
      await this.removeSecureValue('oauth_state');

      return xeroTokens;
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  public async refreshAccessToken(): Promise<XeroTokens | null> {
    try {
      const currentTokens = await this.getStoredTokens();
      if (!currentTokens?.refresh_token) {
        return null;
      }

      const tokenData = {
        grant_type: 'refresh_token',
        refresh_token: currentTokens.refresh_token,
      };

      const response = await fetch('https://identity.xero.com/connect/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.getBasicAuthHeader()}`,
        },
        body: new URLSearchParams(tokenData).toString(),
      });

      if (!response.ok) {
        console.error('Token refresh failed:', response.status);
        return null;
      }

      const tokens = await response.json();

      const refreshedTokens: XeroTokens = {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token || currentTokens.refresh_token,
        expires_at: Date.now() + tokens.expires_in * 1000,
        tenant_id: currentTokens.tenant_id,
        scopes: tokens.scope?.split(' ') || currentTokens.scopes,
      };

      await this.storeTokens(refreshedTokens);
      return refreshedTokens;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Validate current access token
   */
  public async validateToken(): Promise<boolean> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens) {
        return false;
      }

      // Check if token is expired (with 5 minute buffer)
      const isExpired = Date.now() > tokens.expires_at - 300000;
      if (isExpired) {
        // Try to refresh token
        const refreshedTokens = await this.refreshAccessToken();
        return refreshedTokens !== null;
      }

      return true;
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  /**
   * Revoke access tokens and disconnect
   */
  public async revokeToken(): Promise<boolean> {
    try {
      const tokens = await this.getStoredTokens();
      if (!tokens) {
        return true; // Already disconnected
      }

      // Revoke the refresh token
      const response = await fetch('https://identity.xero.com/connect/revocation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${this.getBasicAuthHeader()}`,
        },
        body: new URLSearchParams({
          token: tokens.refresh_token,
          token_type_hint: 'refresh_token',
        }).toString(),
      });

      // Clear stored tokens regardless of revocation success
      await this.clearStoredTokens();

      return response.ok;
    } catch (error) {
      console.error('Error revoking token:', error);
      // Clear tokens even if revocation fails
      await this.clearStoredTokens();
      return false;
    }
  }

  /**
   * Get current access token
   */
  public async getAccessToken(): Promise<string | null> {
    try {
      const isValid = await this.validateToken();
      if (!isValid) {
        return null;
      }

      const tokens = await this.getStoredTokens();
      return tokens?.access_token || null;
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  /**
   * Check if user is connected to Xero
   */
  public async isConnected(): Promise<boolean> {
    return await this.validateToken();
  }

  /**
   * Store tokens securely
   */
  private async storeTokens(tokens: XeroTokens): Promise<void> {
    try {
      // Store sensitive tokens in Keychain
      await Keychain.setInternetCredentials(
        this.KEYCHAIN_SERVICE,
        'xero_tokens',
        JSON.stringify({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        })
      );

      // Store non-sensitive data in AsyncStorage
      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify({
          expires_at: tokens.expires_at,
          tenant_id: tokens.tenant_id,
          scopes: tokens.scopes,
          connected_at: Date.now(),
        })
      );
    } catch (error) {
      console.error('Error storing tokens:', error);
      throw new Error('Failed to store authentication tokens');
    }
  }

  /**
   * Retrieve stored tokens
   */
  public async getStoredTokens(): Promise<XeroTokens | null> {
    try {
      // Get sensitive tokens from Keychain
      const credentials = await Keychain.getInternetCredentials(this.KEYCHAIN_SERVICE);
      if (!credentials || credentials.username !== 'xero_tokens') {
        return null;
      }

      const sensitiveTokens = JSON.parse(credentials.password);

      // Get non-sensitive data from AsyncStorage
      const settingsJson = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (!settingsJson) {
        return null;
      }

      const settings = JSON.parse(settingsJson);

      return {
        access_token: sensitiveTokens.access_token,
        refresh_token: sensitiveTokens.refresh_token,
        expires_at: settings.expires_at,
        tenant_id: settings.tenant_id,
        scopes: settings.scopes || this.config.scopes,
      };
    } catch (error) {
      console.error('Error retrieving tokens:', error);
      return null;
    }
  }

  /**
   * Clear all stored tokens
   */
  private async clearStoredTokens(): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(this.KEYCHAIN_SERVICE);
      await AsyncStorage.removeItem(this.STORAGE_KEY);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  /**
   * Store secure value temporarily
   */
  private async storeSecureValue(key: string, value: string): Promise<void> {
    await Keychain.setInternetCredentials(`${this.KEYCHAIN_SERVICE}_${key}`, key, value);
  }

  /**
   * Get secure value
   */
  private async getSecureValue(key: string): Promise<string | null> {
    try {
      const credentials = await Keychain.getInternetCredentials(`${this.KEYCHAIN_SERVICE}_${key}`);
      return credentials ? credentials.password : null;
    } catch {
      return null;
    }
  }

  /**
   * Remove secure value
   */
  private async removeSecureValue(key: string): Promise<void> {
    try {
      await Keychain.resetInternetCredentials(`${this.KEYCHAIN_SERVICE}_${key}`);
    } catch {
      // Ignore errors when removing
    }
  }

  /**
   * Generate Basic Auth header
   */
  private getBasicAuthHeader(): string {
    const credentials = `${this.config.clientId}:${this.config.clientSecret}`;
    return Buffer.from(credentials).toString('base64');
  }

  /**
   * Generate PKCE code verifier
   */
  private generateCodeVerifier(): string {
    return this.generateRandomString(128);
  }

  /**
   * Generate PKCE code challenge
   */
  private generateCodeChallenge(verifier: string): string {
    return CryptoJS.SHA256(verifier).toString(CryptoJS.enc.Base64url);
  }

  /**
   * Generate random string
   */
  private generateRandomString(length: number): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Open OAuth URL in browser
   */
  public async openAuthUrl(): Promise<void> {
    try {
      const { authUrl } = await this.generateAuthUrl();
      const supported = await Linking.canOpenURL(authUrl);

      if (supported) {
        await Linking.openURL(authUrl);
      } else {
        throw new Error('Cannot open authorization URL');
      }
    } catch (error) {
      console.error('Error opening auth URL:', error);
      throw error;
    }
  }
}

export default XeroAuthService;
