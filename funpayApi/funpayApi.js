import axios from 'axios';

class FunPayApi {
  constructor() {
    this.baseUrl = 'https://funpay.com';
    this.cookies = `PHPSESSID=lNtJxOUkHJlMQBt4Pg%2CtbMTt-Z7hB8vM; golden_key=5ct6b83yxgz2vk5zm7yf2t99783wc6ss; locale=ru`;
    this.csrf = '';
  }

  getHeaders(isPost = false) {
    const headers = {
      'Cookie': this.cookies,
      'Accept': isPost ? 'application/json' : 'text/html',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Origin': 'https://funpay.com',
      'Referer': 'https://funpay.com'
    };

    if (isPost) {
      headers['X-Requested-With'] = 'XMLHttpRequest';
    }

    return headers;
  }

  async createLot(lotData) {
    try {
      // Получаем CSRF токен
      const pageResponse = await axios.get(
        `${this.baseUrl}/lots/offerEdit?node=${lotData.node_id}`,
        { headers: this.getHeaders(false) }
      );

      const formMatch = pageResponse.data.match(/name="csrf_token" value="([^"]+)"/);
      if (!formMatch) {
        throw new Error('CSRF token not found');
      }
      this.csrf = formMatch[1];

      // Формируем данные
      const formData = new URLSearchParams();
      formData.append('csrf_token', this.csrf);
      formData.append('offer_id', '0');
      formData.append('node_id', lotData.node_id);
      formData.append('fields[method]', lotData.method || 'С заходом на аккаунт');
      formData.append('fields[type]', lotData.type || '%Акции-Promotions');
      formData.append('fields[summary][ru]', lotData.title || 'Под заказ');
      formData.append('fields[summary][en]', lotData.title_en || 'By order');
      formData.append('price', lotData.price || '111');
      formData.append('active', 'on');

      // Создаем лот
      const response = await axios.post(
        `${this.baseUrl}/lots/offerSave`,
        formData,
        { headers: this.getHeaders(true) }
      );
      
      return response.data;
    } catch (error) {
      console.error('Error creating lot:', error.message);
      throw error;
    }
  }
}

export { FunPayApi }; 