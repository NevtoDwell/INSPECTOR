import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFormTemplate } from './form_templates_cfg.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class FunPayFormProcessor {
    constructor(offersPath, configPath) {
        this.offersPath = offersPath;
        this.configPath = configPath;
        this.config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        // Чтение описаний из файлов при инициализации
        this.descRu = fs.readFileSync(join(__dirname, 'desc_ru.txt'), 'utf-8').trim();
        this.descEn = fs.readFileSync(join(__dirname, 'desc_en.txt'), 'utf-8').trim();
    }

    static formatDescription(text) {
        // Удаляем все символы в начале и конце строки
        text = text.trim();
        
        // Заменяем группы эмодзи на один ⚡, но сохраняем ➕
        text = text.replace(/(?!➕)[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F100}-\u{1F1FF}\u{1F200}-\u{1F2FF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}<<>>]+/gu, '⚡');
        
        // Добавляем ✅ в начало
        text = `✅ ${text}`;
        
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
            console.log('\nОтправка формы для оффера:', offerData.offer.id);
            console.log('node_id:', offerData.offer.node_id);
            console.log('Данные формы:');
            for (const [key, value] of Object.entries(offerData.formData)) {
                console.log(`${key}: ${value}`);
            }

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

            // Проверяем статус ответа
            if (response.status === 302) {
                console.log(' ✅ Форма успешно отправлена (редирект)');
                try {
                    await this.removeProcessedOffer(offerData.offer);
                    console.log(' 🗑️ Оффер успешно удален из списка');
                } catch (deleteError) {
                    console.error(' ❌ Ошибка при удалении оффера:', deleteError);
                }
                return true;
            } else if (response.status === 200) {
                // Проверяем тип данных ответа
                const responseText = typeof response.data === 'string' 
                    ? response.data 
                    : JSON.stringify(response.data);

                // Проверяем наличие ошибок в ответе
                try {
                    const jsonResponse = JSON.parse(responseText);
                    if (jsonResponse.error === true || (typeof jsonResponse.error === 'string' && jsonResponse.error.toLowerCase() === 'true')) {
                        console.error(' ❌ Сервер вернул ошибку в ответе');
                        console.error(' ❌ Текст ответа:', responseText);
                        return false;
                    }
                    
                    // Проверяем URL в ответе
                    if (!jsonResponse.url || !jsonResponse.url.includes('/lots/')) {
                        console.error(' ❌ Неверный формат URL в ответе');
                        console.error(' ❌ Текст ответа:', responseText);
                        return false;
                    }

                    // Проверяем done в ответе
                    if (!jsonResponse.done) {
                        console.error(' ❌ Операция не завершена успешно');
                        console.error(' ❌ Текст ответа:', responseText);
                        return false;
                    }
                } catch (e) {
                    // Если не удалось распарсить JSON, проверяем текст на наличие слова "ошибка"
                    if (responseText.toLowerCase().includes('ошибка')) {
                        console.error(' ❌ Сервер вернул ошибку в ответе');
                        console.error(' ❌ Текст ответа:', responseText);
                        return false;
                    }
                }

                console.log(' ✅ Форма успешно отправлена (статус 200)');
                try {
                    await this.removeProcessedOffer(offerData.offer);
                    console.log(' 🗑️ Оффер успешно удален из списка');
                } catch (deleteError) {
                    console.error(' ❌ Ошибка при удалении оффера:', deleteError);
                }
                return true;
            }

            console.error(' ❌ Ошибка при отправке формы. Статус:', response.status);
            if (response.data) {
                const responseText = typeof response.data === 'string' 
                    ? response.data 
                    : JSON.stringify(response.data);
                console.error(' ❌ Ответ сервера:', responseText);
            }
            return false;
        } catch (error) {
            console.error(' ❌ Ошибка при отправке формы:', error.message);
            return false;
        }
    }

    async readOffersToAdd() {
        try {
            console.log('Читаем файл с предложениями...');
            const data = fs.readFileSync(this.offersPath, 'utf8');
            console.log('Файл прочитан, парсим JSON...');
            const offers = JSON.parse(data);
            
            console.log(' Всего офферов:', offers.length);

            // Фильтруем офферы только с node_id "1142" и "1560"
            const filteredOffers = offers.filter(o => 
                (o.node_id === "1142" || o.node_id === "1560" || o.node_id === "965" || o.node_id === "1127" || o.node_id === "1130" || o.node_id === "1129" || o.node_id === "1135" || o.node_id === "1697" || o.node_id === "1755" || o.node_id === "609" || o.node_id === "1523" 
                    || o.node_id === "1476" || o.node_id === "1133"
                ) && 
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
            console.error('Ошибка при чтении файла с предложениями:', error.message);
            return [];
        }
    }

    async processAllOffers() {
        try {
            console.log('Начинаем обработку предложений...');
            const offers = await this.readOffersToAdd();
            console.log(`Найдено ${offers.length} предложений для обработки`);

            for (const [index, offer] of offers.entries()) {
                try {
                    console.log(`\n📦 Обработка оффера ${index + 1}/${offers.length}`);
                    
                    // Добавляем подробную информацию об оффере
                    console.log('\x1b[36m🎮 Детали оффера:\x1b[0m');
                    console.log(`\x1b[32mНазвание: ${offer.title}\x1b[0m`);
                    console.log(`\x1b[32mNode ID: ${offer.node_id}\x1b[0m`);
                    console.log(`\x1b[32mЦена: ${offer.price}\x1b[0m`);
                    console.log(`\x1b[32mОписание (RU): ${offer.descText}\x1b[0m`);
                    console.log(`\x1b[32mОписание (EN): ${offer.descTextEn}\x1b[0m`);
                    console.log(`\x1b[32mСсылка на оффер: ${offer.offerLink}\x1b[0m`);

                    const template = getFormTemplate(offer.node_id);
                    if (!template) {
                        console.log(`⚠️ Пропуск оффера: неподдерживаемый node_id ${offer.node_id}`);
                        continue;
                    }

                    const formData = template.getFormData(offer, {
                        csrf_token: this.config.csrf_token,
                        descRu: this.descRu,
                        descEn: this.descEn
                    });

                    try {
                        console.log(`Обрабатываем предложение: ${JSON.stringify(offer)}`);
                        const submitResult = await this.submitForm({
                            offer,
                            formData,
                            cookies: this.config.cookies,
                            url: `https://funpay.com/lots/offerEdit?node=${offer.node_id}`,
                            submitUrl: 'https://funpay.com/lots/offerSave'
                        });

                        if (submitResult) {
                            console.log('Предложение успешно добавлено');
                            await this.removeProcessedOffer(offer);
                            console.log('Предложение удалено из списка');
                        } else {
                            console.log('❌ Ошибка при отправке оффера', index + 1);
                        }

                        console.log(`⏳ Ожидание 2 секунд перед следующим оффером...`);
                        await new Promise(resolve => setTimeout(resolve, 2000));

                    } catch (submitError) {
                        console.error(`❌ Ошибка при отправке оффера ${index + 1}:`, submitError);
                        continue;
                    }
                } catch (error) {
                    console.error('Ошибка при обработке предложения:', error.message);
                }
            }

            return true;
        } catch (error) {
            console.error('Ошибка при обработке всех предложений:', error.message);
            return false;
        }
    }

    async main() {
        try {
            console.log('Запуск обработки предложений...');
            const processor = new FunPayFormProcessor(
                path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
                path.join(__dirname, 'config.json')
            );

            // Вместо processNextOffer() используем processAllOffers()
            await processor.processAllOffers();
            console.log('Обработка завершена');
        } catch (error) {
            console.error('Ошибка в main():', error);
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
    try {
        console.log('Запуск обработки предложений...');
        const processor = new FunPayFormProcessor(
            path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
            path.join(__dirname, 'config.json')
        );

        // Вместо processNextOffer() используем processAllOffers()
        await processor.processAllOffers();
        console.log('Обработка завершена');
    } catch (error) {
        console.error('Ошибка в main():', error);
    }
}

// Запускаем основную функцию если файл запущен напрямую
if (import.meta.url.startsWith('file:')) {
    main().catch(error => {
        console.error('Необработанная ошибка:', error);
        process.exit(1);
    });
}

export { FunPayFormProcessor };
// Экспортируем статический метод отдельно для удобства
export const formatDescription = FunPayFormProcessor.formatDescription;
