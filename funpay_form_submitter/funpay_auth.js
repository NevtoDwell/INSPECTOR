import axios from 'axios';
import chalk from 'chalk';
import { getTimestamp } from './utils/timestamp.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для декодирования HTML-сущностей
function decodeHtmlEntities(str) {
    return str.replace(/&quot;/g, '"')
              .replace(/&amp;/g, '&')
              .replace(/&lt;/g, '<')
              .replace(/&gt;/g, '>')
              .replace(/&#39;/g, "'");
}

// Функция для чтения golden_key из файла
function getGoldenKey() {
    try {
        const configPath = path.join(__dirname, 'auth_golden_key.config');
        const content = fs.readFileSync(configPath, 'utf8').trim();
        const match = content.match(/golden_key=([^;]+)/);
        return match ? match[1] : '';
    } catch (error) {
        console.log(`${getTimestamp()} ${chalk.red.bold('ОШИБКА ЧТЕНИЯ GOLDEN KEY:')} ${error.message}`);
        return '';
    }
}

export async function getAuthData() {
    try {
        console.log(`${getTimestamp()} ${chalk.yellow.bold('ПОЛУЧЕНИЕ ДАННЫХ АВТОРИЗАЦИИ')}`);
        
        // Читаем golden_key
        const goldenKey = getGoldenKey();
        if (!goldenKey) {
            throw new Error('НЕ УДАЛОСЬ ПРОЧИТАТЬ GOLDEN KEY');
        }
        
        const response = await axios.get('https://funpay.com/', {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.8,en-US;q=0.5,en;q=0.3',
                'Accept-Encoding': 'gzip, deflate, br',
                'Connection': 'keep-alive',
                'Upgrade-Insecure-Requests': '1',
                'Cookie': `golden_key=${goldenKey}`
            }
        });

        const html = response.data;

        // Получаем data-app-data из body
        const bodyMatch = html.match(/<body[^>]+data-app-data="([^"]+)"/);
        if (!bodyMatch) {
            console.log(`${getTimestamp()} ${chalk.yellow('HTML ответ:')}`);
            console.log(html.substring(0, 1000));
            throw new Error('НЕ УДАЛОСЬ НАЙТИ DATA-APP-DATA');
        }

        try {
            const decoded = decodeHtmlEntities(decodeURIComponent(bodyMatch[1]));
            const appData = JSON.parse(decoded);
            
            if (!appData["csrf-token"]) {
                throw new Error('НЕТ CSRF-TOKEN В DATA-APP-DATA');
            }

            // Получаем все куки из ответа
            const newCookies = response.headers['set-cookie'];
            const cookieString = newCookies ? 
                newCookies.map(cookie => cookie.split(';')[0]).join('; ') + `; golden_key=${goldenKey}` :
                `golden_key=${goldenKey}`;

            return {
                cookies: cookieString,
                csrf_token: appData["csrf-token"]
            };
        } catch (e) {
            console.log(`${getTimestamp()} ${chalk.yellow('Ошибка парсинга data-app-data:')} ${e.message}`);
            throw new Error('ОШИБКА ПОЛУЧЕНИЯ CSRF-TOKEN');
        }
    } catch (error) {
        console.log(`${getTimestamp()} ${chalk.red.bold('ОШИБКА ПОЛУЧЕНИЯ ДАННЫХ АВТОРИЗАЦИИ:')} ${error.message}`);
        if (error.response) {
            console.log(`${getTimestamp()} ${chalk.red('Статус ответа:')} ${error.response.status}`);
        }
        throw error;
    }
}
