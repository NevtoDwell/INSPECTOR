const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');

class FunPayFormProcessor {
    constructor(offersPath, configPath) {
        this.offersPath = offersPath;
        this.configPath = configPath;
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }

    processNextOffer() {
        const offers = JSON.parse(fs.readFileSync(this.offersPath, 'utf8'));
        
        // Находим первый непустой оффер
        const offer = offers.find(o => 
            o.descText && 
            o.price && 
            o.node_id
        );

        if (!offer) {
            console.log('Нет подходящих офферов для обработки');
            return null;
        }

        const formData = {
            csrf_token: 'y4kheox48arw8ko3', // Статический токен
            form_created_at: Math.floor(Date.now() / 1000),
            offer_id: 0,
            node_id: offer.node_id,
            location: '',
            deleted: '',
            'fields[quantity]': '90 алмазов',
            'fields[desc][ru]': offer.descText,
            'fields[desc][en]': offer.descText,
            'fields[payment_msg][ru]': '',
            'fields[payment_msg][en]': '',
            price: offer.price,
            amount: 1,
            active: 'on'
        };

        return {
            formData,
            offer,
            cookies: this.config.cookies,
            url: `https://funpay.com/lots/${offer.node_id}/trade`
        };
    }

    // Метод для удаления обработанного оффера
    removeProcessedOffer(offer) {
        const offers = JSON.parse(fs.readFileSync(this.offersPath, 'utf8'));
        const updatedOffers = offers.filter(o => 
            o.descText !== offer.descText || 
            o.price !== offer.price || 
            o.node_id !== offer.node_id
        );
        
        fs.writeFileSync(this.offersPath, JSON.stringify(updatedOffers, null, 2), 'utf8');
    }

    async submitForm(offerData) {
        try {
            const form = new FormData();
            
            // Добавляем все поля формы
            for (const [key, value] of Object.entries(offerData.formData)) {
                form.append(key, value);
            }

            const response = await axios.post(offerData.url, form, {
                headers: {
                    ...form.getHeaders(),
                    'Cookie': offerData.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': offerData.url,
                    'Origin': 'https://funpay.com'
                },
                maxRedirects: 0,
                validateStatus: function (status) {
                    return status >= 200 && status < 400; // Reject only if the status code is not in 2xx or 3xx range
                }
            });

            console.log('Форма успешно отправлена:', response.status);
            
            // Удаляем обработанный оффер
            this.removeProcessedOffer(offerData.offer);

            return response;
        } catch (error) {
            console.error('Ошибка при отправке формы:', error.response ? error.response.data : error.message);
            return null;
        }
    }
}

// Основная функция для запуска процесса
async function main() {
    const processor = new FunPayFormProcessor(
        path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
        path.join(__dirname, 'config.json')
    );

    const nextOffer = processor.processNextOffer();
    if (nextOffer) {
        console.log('Подготовлены данные для отправки:', nextOffer.formData);
        await processor.submitForm(nextOffer);
    }
}

// Запускаем основную функцию
main().catch(console.error);

module.exports = FunPayFormProcessor;
