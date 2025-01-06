const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { join } = require('path');

class FunPayFormProcessor {
    constructor(offersPath, configPath) {
        this.offersPath = offersPath;
        this.configPath = configPath;
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Чтение описаний из файлов при инициализации
        this.descRu = fs.readFileSync(join(__dirname, 'desc_ru.txt'), 'utf-8').trim();
        this.descEn = fs.readFileSync(join(__dirname, 'desc_en.txt'), 'utf-8').trim();
    }

    formatDescription(text) {
        // Удаляем все символы в начале и конце строки, оставляя только текст
        text = text.replace(/^[^\w\s]+|[^\w\s]+$/g, '');
        
        // Добавляем ✅ и ⚡ в начало и конец
        text = `✅ ⚡ ${text.trim()} ⚡`;
        
        return text;
    }

    async removeProcessedOffer(offer) {
        try {
            // Используем абсолютный путь к файлу
            const offersPath = path.resolve(__dirname, '../differenceBetweenOffers/offers_to_add.json');
            console.log(' 📁 Путь к файлу offers_to_add.json:', offersPath);
            
            // Проверяем существование файла
            if (!fs.existsSync(offersPath)) {
                throw new Error(`Файл ${offersPath} не найден`);
            }

            // Читаем текущий список офферов
            const offers = JSON.parse(fs.readFileSync(offersPath, 'utf8'));
            console.log(' 📊 Количество офферов до удаления:', offers.length);
            
            // Находим индекс оффера для удаления
            const offerIndex = offers.findIndex(o => 
                o.node_id === offer.node_id && 
                o.descText === offer.descText && 
                o.price === offer.price
            );

            if (offerIndex !== -1) {
                // Удаляем оффер
                offers.splice(offerIndex, 1);
                console.log(' 📊 Количество офферов после удаления:', offers.length);
                
                // Сохраняем обновленный список
                await fs.promises.writeFile(
                    offersPath, 
                    JSON.stringify(offers, null, 2), 
                    'utf-8'
                );
                
                console.log(' ✨ Оффер успешно удален из offers_to_add.json');
                return true;
            } else {
                console.warn(' ⚠️ Оффер не найден в списке для удаления');
                return false;
            }
        } catch (error) {
            console.error(' ❌ Ошибка при удалении оффера:', error);
            throw error;
        }
    }

    async submitForm(offerData) {
        try {
            // Сначала проверим куки
            if (!offerData.cookies.includes('PHPSESSID') || !offerData.cookies.includes('golden_key')) {
                console.error(' Ошибка: Отсутствуют важные куки для авторизации (PHPSESSID или golden_key)');
                return false;
            }

            // Добавляем предварительный GET запрос для проверки авторизации
            const formPageResponse = await axios.get(offerData.url, {
                headers: {
                    'Cookie': offerData.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
            });

            // Проверяем признаки авторизации в ответе
            if (formPageResponse.data.includes('login') || 
                formPageResponse.data.includes('auth') || 
                formPageResponse.data.includes('войти') ||
                formPageResponse.data.includes('авторизац')) {
                console.error(' Ошибка: Пользователь не авторизован');
                console.error(' Возможно, куки устарели или недействительны');
                return false;
            }

            // Проверяем доступ к форме
            if (!formPageResponse.data.includes('offerSave')) {
                console.error(' Ошибка: Нет доступа к форме создания оффера');
                console.error(' Проверьте права доступа и авторизацию');
                return false;
            }

            console.log(' Авторизация успешна, продолжаем...');

            // Извлекаем CSRF токен из страницы
            const csrfToken = extractCsrfToken(formPageResponse.data);
            console.log(' Извлеченный CSRF токен:', csrfToken);

            const form = new FormData();
            
            // Обновляем CSRF токен в данных формы
            offerData.formData.csrf_token = csrfToken;

            // Добавляем все поля в форму
            for (const [key, value] of Object.entries(offerData.formData)) {
                form.append(key, value);
            }

            const formCreatedAt = extractFormCreatedAt(formPageResponse.data);
            offerData.formData.form_created_at = formCreatedAt;
            console.log(' Извлеченный form_created_at:', formCreatedAt);

            const response = await axios.post(offerData.submitUrl, form, {
                headers: {
                    ...form.getHeaders(),
                    'Cookie': offerData.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                    'Referer': offerData.url,
                    'Origin': 'https://funpay.com',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
                    'X-Requested-With': 'XMLHttpRequest',
                    'Connection': 'keep-alive',
                    'Sec-Fetch-Dest': 'document',
                    'Sec-Fetch-Mode': 'navigate',
                    'Sec-Fetch-Site': 'same-origin',
                    'Sec-Fetch-User': '?1',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 0,
                validateStatus: function (status) {
                    return true;
                }
            });

            // Проверяем успешность отправки и удаляем оффер только здесь
            if (response.status === 302 || response.status === 200) {
                console.log(' ✅ Форма успешно отправлена');
                try {
                    // Удаляем оффер только после успешной отправки
                    await this.removeProcessedOffer(offerData.offer);
                    console.log(' 🗑️ Оффер успешно удален из списка');
                } catch (deleteError) {
                    console.error(' ❌ Ошибка при удалении оффера:', deleteError);
                }
                return true;
            }

            console.error(' ❌ Ошибка при отправке формы. Статус:', response.status);
            console.error(' ❌ Ответ сервера:', response.data);
            return false;
        } catch (error) {
            console.error(' ❌ Ошибка при отправке формы:', error.message);
            return false;
        }
    }

    async readOffersToAdd() {
        try {
            const offers = JSON.parse(fs.readFileSync(this.offersPath, 'utf8'));
            
            console.log(' Всего офферов:', offers.length);

            // Фильтруем офферы только с node_id "1142" и "1560"
            const filteredOffers = offers.filter(o => 
                (o.node_id === "1142" || o.node_id === "1560") && 
                o.descText && 
                o.price
            );

            if (filteredOffers.length === 0) {
                console.error(' Нет подходящих офферов для обработки');
                console.error('Причины:');
                console.error('- Нет офферов с node_id "1142" или "1560"');
                console.error('- Отсутствие descText');
                console.error('- Отсутствие price');
                return [];
            }

            // Разворачиваем массив, чтобы начать с последнего оффера
            const reversedOffers = filteredOffers.reverse();

            console.log(' Выбраны офферы с node_id "1142" и "1560":', reversedOffers.length);
            console.log(' Первый оффер (с конца):', JSON.stringify(reversedOffers[0], null, 2));

            return reversedOffers;
        } catch (error) {
            console.error(' Ошибка при чтении офферов:', error);
            return [];
        }
    }

    async processAllOffers() {
        try {
            const offers = await this.readOffersToAdd();
            
            if (offers.length === 0) {
                console.log('❌ Нет офферов для обработки');
                return false;
            }

            console.log(`🚀 Начинаем обработку ${offers.length} офферов`);

            for (const [index, offer] of offers.entries()) {
                console.log(`\n📦 Обработка оффера ${index + 1}/${offers.length}`);
                
                // Добавляем подробную информацию об оффере
                console.log('\x1b[36m🎮 Детали оффера:\x1b[0m');
                console.log(`\x1b[32mНазвание: ${offer.title}\x1b[0m`);
                console.log(`\x1b[32mNode ID: ${offer.node_id}\x1b[0m`);
                console.log(`\x1b[32mЦена: ${offer.price}\x1b[0m`);
                console.log(`\x1b[32mОписание (RU): ${offer.descText}\x1b[0m`);
                console.log(`\x1b[32mОписание (EN): ${offer.descTextEn}\x1b[0m`);
                console.log(`\x1b[32mСсылка на оффер: ${offer.offerLink}\x1b[0m`);

                // Определяем формат данных в зависимости от node_id
                let formData;
                
                if (offer.node_id === "1142") { //Arknights
                    formData = {
                        csrf_token: this.config.csrf_token,
                        offer_id: '',
                        node_id: offer.node_id,
                        location: '',
                        deleted: '',
                        'fields[type]': 'Паки',
                        'fields[summary][ru]': this.formatDescription(offer.descText),
                        'fields[summary][en]': this.formatDescription(offer.descTextEn),
                        'fields[desc][ru]': this.descRu,
                        'fields[desc][en]': this.descEn,
                        'fields[payment_msg][ru]': ' ',
                        'fields[payment_msg][en]': ' ',
                        price: offer.price, 
                        amount: '999',
                        active: 'on'
                    };
                } else if (offer.node_id === "1560") { //Asphalt
                    // Увеличиваем цену на 10%
                    const originalPrice = parseFloat(offer.price.replace(/[^\d.]/g, '')); // Убираем все символы кроме цифр и точки
                    const increasedPrice = Math.round(originalPrice / 1.10);
                    
                    console.log(' 💰 Исходная строка цены:', offer.price);
                    console.log(' 💰 Очищенная цена:', originalPrice);
                    console.log(' 💰 Рассчитанная цена:', increasedPrice);

                    formData = {
                        csrf_token: this.config.csrf_token,
                        offer_id: '',
                        node_id: offer.node_id,
                        location: '',
                        deleted: '',
                        server_id: '9074',
                        'fields[method]': 'С заходом на аккаунт',
                        'fields[summary][ru]': this.formatDescription(offer.descText),
                        'fields[summary][en]': '',
                        'fields[desc][ru]': this.descRu,
                        'fields[desc][en]': '',
                        'fields[payment_msg][ru]': ' ',
                        'fields[payment_msg][en]': ' ',
                        'fields[images]': '',
                        price: increasedPrice,
                        deactivate_after_sale: '',
                        active: 'on'
                    };

                    // Логируем данные формы
                    console.log(' 📝 Данные формы:', JSON.stringify(formData, null, 2));
                }

                if (!formData) {
                    console.log(`⚠️ Пропуск оффера: неподдерживаемый node_id ${offer.node_id}`);
                    continue;
                }

                try {
                    const result = await this.submitForm({
                        formData,
                        offer,
                        cookies: this.config.cookies,
                        url: `https://funpay.com/lots/offerEdit?node=${offer.node_id}`,
                        submitUrl: 'https://funpay.com/lots/offerSave'
                    });

                    if (!result) {
                        console.error(`❌ Ошибка при отправке оффера ${index + 1}`);
                    }

                    console.log(`⏳ Ожидание 2 секунд перед следующим оффером...`);
                    await new Promise(resolve => setTimeout(resolve, 2000));

                } catch (submitError) {
                    console.error(`❌ Ошибка при отправке оффера ${index + 1}:`, submitError);
                    continue;
                }
            }

            return true;
        } catch (error) {
            console.error('❌ Ошибка при обработке офферов:', error);
            return false;
        }
    }

    async main() {
        try {
            const processor = new FunPayFormProcessor(
                path.join(__dirname, 'offers_to_add.json'),
                path.join(__dirname, 'config.json')
            );

            await processor.processAllOffers();
        } catch (error) {
            console.error('Ошибка в main:', error);
        }
    }
}

function extractCsrfToken(html) {
    // Ищем мета тег с csrf токеном
    const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
    if (csrfMatch && csrfMatch[1]) {
        return csrfMatch[1];
    }
    
    // Или ищем в форме
    const formTokenMatch = html.match(/name="csrf_token" value="([^"]+)"/);
    if (formTokenMatch && formTokenMatch[1]) {
        return formTokenMatch[1];
    }
    
    throw new Error('CSRF token not found');
}

function extractFormCreatedAt(html) {
    const match = html.match(/name="form_created_at"\s+value="(\d+)"/);
    return match ? match[1] : Math.floor(Date.now() / 1000);
}

// Заменяем текущую функцию main() на:
async function main() {
    const processor = new FunPayFormProcessor(
        path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
        path.join(__dirname, 'config.json')
    );

    // Вместо processNextOffer() используем processAllOffers()
    await processor.processAllOffers();
}

// Запускаем основную функцию
main().catch(console.error);

module.exports = FunPayFormProcessor;
