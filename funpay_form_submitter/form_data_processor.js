import fs from 'fs';
import path from 'path';
import axios from 'axios';
import FormData from 'form-data';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFormTemplate } from './form_templates_cfg.js';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const time = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return chalk.hex('#6CB6FF')(`[${date} ${time}]`);
}

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
            const data = fs.readFileSync(this.offersPath, 'utf8');
            let offers = JSON.parse(data);
            
            const initialLength = offers.length;
            offers = offers.filter(o => o.offerLink !== offer.offerLink);
            
            if (offers.length === initialLength) {
                return; // Оффер не был найден, нет необходимости сохранять файл
            }

            fs.writeFileSync(this.offersPath, JSON.stringify(offers, null, 2));
        } catch (error) {
            throw new Error(`Ошибка при удалении оффера: ${error.message}`);
        }
    }

    async checkOfferExists(offerData) {
        try {
            console.log(`${getTimestamp()} ${chalk.gray('ℹ')} Проверяем наличие предложения на сайте...`);
            
            // URL страницы с предложениями пользователя (используем категорию из node_id)
            const userOffersUrl = `https://funpay.com/lots/${offerData.offer.node_id}/trade`;
            
            const response = await axios.get(userOffersUrl, {
                headers: {
                    'Cookie': this.config.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
            });

            if (response.status === 200) {
                const html = response.data;
                
                // Проверяем наличие node_id в URL
                const nodeIdPattern = `node=${offerData.offer.node_id}`;
                if (!html.includes(nodeIdPattern)) {
                    return false;
                }

                // Проверяем наличие описания предложения на странице
                const description = offerData.formData['fields[summary][ru]'];
                if (!description || !html.includes(description)) {
                    return false;
                }
                
                // Проверяем наличие цены предложения
                const price = offerData.formData.price;
                if (!price || !html.includes(price)) {
                    return false;
                }

                return true;
            }

            console.log(`${getTimestamp()} ${chalk.red.bold('❌ ОШИБКА:')} Не удалось получить страницу с предложениями (статус: ${response.status})`);
            return false;
        } catch (error) {
            console.log('\nДетали ошибки:');
            console.log('Сообщение:', error.message);
            if (error.response) {
                console.log('Статус:', error.response.status);
                console.log('Данные ответа:', error.response.data);
            }
            console.log('URL:', offerData.submitUrl);
            return false;
        }
    }

    async submitForm(offerData) {
        try {
            // Создаем FormData для отправки
            const form = new FormData();
            for (const [key, value] of Object.entries(offerData.formData)) {
                form.append(key, value);
            }

            // Добавляем поле form_created_at если его нет
            if (!offerData.formData.form_created_at) {
                const timestamp = Math.floor(Date.now() / 1000);
                form.append('form_created_at', timestamp);
            }

            const response = await axios({
                method: 'post',
                url: offerData.submitUrl,
                data: form,
                headers: {
                    ...form.getHeaders(),
                    'Cookie': this.config.cookies,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
                    'Accept-Encoding': 'gzip, deflate, br',
                    'Origin': 'https://funpay.com',
                    'Referer': offerData.url,
                    'DNT': '1',
                    'Connection': 'keep-alive',
                    'Upgrade-Insecure-Requests': '1'
                },
                maxRedirects: 5,
                validateStatus: function (status) {
                    return true;
                }
            });

            console.log(`${getTimestamp()} ${chalk.gray('ℹ')} Ожидаем 5 секунд перед проверкой...`);
            await new Promise(resolve => setTimeout(resolve, 5000));
            
            const exists = await this.checkOfferExists(offerData);
            
            if (exists) {
                try {
                    await this.removeProcessedOffer(offerData.offer);
                } catch (deleteError) {
                    console.log(`${getTimestamp()} ${chalk.yellow.bold('⚠ ВНИМАНИЕ:')} Предложение создано, но не удалено из списка`);
                }
                return true;
            }

            return false;
        } catch (error) {
            console.log('\nДетали ошибки:');
            console.log('Сообщение:', error.message);
            if (error.response) {
                console.log('Статус:', error.response.status);
                console.log('Данные ответа:', error.response.data);
            }
            console.log('URL:', offerData.submitUrl);
            return false;
        }
    }

    async readOffersToAdd() {
        try {
            console.log(`${getTimestamp()} ${chalk.blue.bold('📂 ЧТЕНИЕ:')} Загрузка файла предложений...`);
            const data = fs.readFileSync(this.offersPath, 'utf8');
            
            console.log(`${getTimestamp()} ${chalk.blue.bold('🔄 ОБРАБОТКА:')} Парсинг JSON...`);
            const offers = JSON.parse(data);

            // Фильтруем офферы только с node_id "1142" и "1560"
            const filteredOffers = offers.filter(o => 
                (o.node_id === "1142" || o.node_id === "1560" || o.node_id === "965" || o.node_id === "1127" || o.node_id === "1130" || o.node_id === "1129" || o.node_id === "1135" || o.node_id === "1697" || o.node_id === "1755" || o.node_id === "609" || o.node_id === "1523" 
                || o.node_id === "1476" || o.node_id === "1133"
            ) && 
            o.descText && 
            o.price
        );

        if (filteredOffers.length === 0) {
            console.log(`${getTimestamp()} ${chalk.yellow.bold('⚠ ВНИМАНИЕ:')} Нет предложений для обработки`);
            return [];
        }

        console.log(`${getTimestamp()} ${chalk.blue.bold('📦 НАЧАЛО ОБРАБОТКИ ПРЕДЛОЖЕНИЙ...')}`);
        console.log(`${getTimestamp()} ${chalk.blue.bold(`Найдено новых предложений: ${chalk.yellow.bold(filteredOffers.length)}`)}\n`);
        
        let successCount = 0;
        let failedCount = 0;

        // Переворачиваем массив для обработки с конца
        const reversedOffers = filteredOffers.reverse();

        return reversedOffers;

    } catch (error) {
        console.log(`${getTimestamp()} ${chalk.red.bold('❌ ОШИБКА:')} При чтении файла: ${error.message}`);
        return [];
    }
}

    async processAllOffers() {
        const offers = await this.readOffersToAdd();
        if (!offers || offers.length === 0) {
            console.log(`${getTimestamp()} ${chalk.yellow.bold('⚠ ВНИМАНИЕ:')} Нет предложений для обработки`);
            return;
        }

        let successCount = 0;
        let failedCount = 0;

        for (let i = 0; i < offers.length; i++) {
            console.log(chalk.yellow('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
            console.log(`${chalk.yellow('┃')}      ${chalk.yellow.bold(`ПРЕДЛОЖЕНИЕ ${i + 1} ИЗ ${offers.length}`)}`);
            console.log(chalk.yellow('┣━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));

            const template = getFormTemplate(offers[i].node_id);
            if (!template) {
                console.log(`${getTimestamp()} ${chalk.yellow.bold('⚠ ПРОПУСК:')} неподдерживаемый node_id ${offers[i].node_id}\n`);
                continue;
            }

            const formData = template.getFormData(offers[i], {
                csrf_token: this.config.csrf_token,
                descRu: this.descRu,
                descEn: this.descEn
            });

            console.log(`${chalk.yellow('┃')}  ${chalk.white.bold('Название:')} ${chalk.yellow(offers[i].title)}`);
            console.log(`${chalk.yellow('┃')}  ${chalk.white.bold('Предложение:')} ${chalk.yellow(formData['fields[summary][ru]'] || 'Нет названия')}`);
            console.log(`${chalk.yellow('┃')}  ${chalk.white.bold('Цена:')} ${chalk.yellow(offers[i].price)}`);
            console.log(`${chalk.yellow('┃')}  ${chalk.white.bold('ID:')} ${chalk.yellow(offers[i].node_id)}`);
            console.log(chalk.yellow('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');

            const success = await this.submitForm({
                offer: offers[i],
                formData,
                url: `https://funpay.com/lots/offerEdit?node=${offers[i].node_id}`,
                submitUrl: 'https://funpay.com/lots/offerSave'
            });
            
            if (success) {
                successCount++;
                console.log('\n' + chalk.green('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
                console.log(`${chalk.green('┃')}      ${chalk.green.bold('УСПЕХ: Предложение успешно добавлено')}`);
                console.log(chalk.green('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');
            } else {
                failedCount++;
                // Выводим данные формы
                console.log('\nОтправленные данные формы:');
                for (const [key, value] of Object.entries(formData)) {
                    console.log(`${key}: ${value}`);
                }

                console.log('\n' + chalk.red('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
                console.log(`${chalk.red('┃')}      ${chalk.red.bold('ОШИБКА ДОБАВЛЕНИЯ')}`);
                console.log(`${chalk.red('┃')}      ${chalk.white.bold('Не удалось добавить предложение')}`);
                console.log(chalk.red('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');
            }

            if (i < offers.length - 1) {
                console.log(`${getTimestamp()} ${chalk.blue.bold('⏳ ОЖИДАНИЕ:')} Пауза 5 секунд перед следующим предложением...\n`);
                await new Promise(resolve => setTimeout(resolve, 5000));
            }
        }

        console.log('\n' + chalk.green('┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'));
        console.log(`${chalk.green('┃')}      ${chalk.green.bold('ОБРАБОТКА ЗАВЕРШЕНА')}`);
        console.log(`${chalk.green('┃')}      ${chalk.white.bold(`Всего предложений: ${chalk.yellow.bold(offers.length)}`)}`);
        console.log(`${chalk.green('┃')}      ${chalk.white.bold(`Успешно: ${chalk.green.bold(successCount)} ${chalk.white.bold('/')} Неудачно: ${chalk.red.bold(failedCount)}`)}`);
        console.log(chalk.green('┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') + '\n');
    }

    async main() {
        try {
            const processor = new FunPayFormProcessor(
                path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
                path.join(__dirname, 'config.json')
            );

            await processor.processAllOffers();
        } catch (error) {
            console.log(`${getTimestamp()} ${chalk.red.bold('❌ ОШИБКА:')} ${error.message}`);
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

// Запускаем основную функцию если файл запущен напрямую
if (import.meta.url.startsWith('file:')) {
    (async () => {
        try {
            const processor = new FunPayFormProcessor(
                path.join(__dirname, '../differenceBetweenOffers/offers_to_add.json'),
                path.join(__dirname, 'config.json')
            );

            await processor.processAllOffers();
        } catch (error) {
            console.log(`${getTimestamp()} ${chalk.red.bold('❌ ОШИБКА:')} ${error.message}`);
        }
    })();
}

export { FunPayFormProcessor };
// Экспортируем статический метод отдельно для удобства
export const formatDescription = FunPayFormProcessor.formatDescription;
