import axios from 'axios';
import OAuth from 'oauth-1.0a';
import crypto from 'crypto';

export class USOSClient {
  private oauth: OAuth;
  private baseUrl: string;
  private consumerKey: string;
  private consumerSecret: string;

  constructor() {
    this.baseUrl = process.env.USOS_API_URL || 'https://usosapps.amu.edu.pl';
    this.consumerKey = process.env.USOS_CONSUMER_KEY || '';
    this.consumerSecret = process.env.USOS_CONSUMER_SECRET || '';

    this.oauth = new OAuth({
      consumer: {
        key: this.consumerKey,
        secret: this.consumerSecret,
      },
      signature_method: 'HMAC-SHA1',
      hash_function(base_string: string, key: string) {
        return crypto.createHmac('sha1', key).update(base_string).digest('base64');
      },
    });
  }

  /**
   * Wykonuje zapytanie do USOS API z autoryzacją OAuth1.0a (standard USOS)
   */
  async request(method: string, path: string, data: any = null) {
    const url = `${this.baseUrl}/${path}`;
    const requestData = {
      url,
      method,
      data,
    };

    // W USOS API często wymagany jest token użytkownika (Access Token) dla operacji zapisu
    // Jeśli masz uprawnienia administracyjne "na klucz", token może nie być wymagany
    const headers = this.oauth.toHeader(this.oauth.authorize(requestData));

    try {
      const response = await axios({
        ...requestData,
        headers: {
          ...headers,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      return response.data;
    } catch (error: any) {
      console.error(`USOS API Error (${path}):`, error.response?.data || error.message);
      throw error;
    }
  }

  // Przykład metody do pobierania dostępnych usług (apiref)
  async getAvailableMethods() {
    return this.request('GET', 'services/apiref/method_index');
  }
}
