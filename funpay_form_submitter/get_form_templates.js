import axios from 'axios';
import * as cheerio from 'cheerio';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Функция для получения данных формы для категории
async function getFormMetadata(categoryId, cookies) {
    try {
        console.log(chalk.cyan('\n→') + ' Получаем данные формы для категории', chalk.yellow(categoryId));

        // Сначала пробуем найти существующий оффер
        console.log(chalk.blue('ℹ Пробуем найти существующий оффер...'));
        const offerId = await getExistingOfferId(categoryId, cookies);
        
        if (offerId) {
            console.log(chalk.green('✓ Найден существующий оффер:', chalk.yellow(offerId)));
            console.log(chalk.blue('ℹ Получаем данные из существующего оффера...'));
            
            // Получаем данные формы из существующего оффера
            const offerFormData = await getOfferFormData(offerId, categoryId, cookies);
            if (offerFormData) {
                return offerFormData;
            }
        }

        // Если не нашли существующий оффер, пробуем получить форму напрямую
        const url = `https://funpay.com/lots/offerEdit?node=${categoryId}`;
        console.log(chalk.blue('ℹ'), 'URL:', chalk.underline(url));

        const response = await axios.get(url, {
            headers: {
                'Cookie': cookies
            }
        });

        const $ = cheerio.load(response.data);

        // Проверяем, есть ли сообщение о множестве предложений
        const warningMessage = $('.alert.alert-warning').text();
        if (warningMessage.includes('У вас уже есть предложения')) {
            console.log(chalk.yellow('⚠ Обнаружено сообщение о множестве предложений'));
            return null;
        }

        return $;
    } catch (error) {
        console.log(chalk.red('✗ Ошибка:', error.message));
        return null;
    }
}

// Функция для поиска существующего оффера
async function getExistingOfferId(categoryId, cookies) {
    try {
        console.log(chalk.cyan('\n→ Поиск существующего оффера'));
        const categoryUrl = `https://funpay.com/lots/${categoryId}/trade`;
        console.log(chalk.blue('ℹ'), 'URL категории:', chalk.underline(categoryUrl));

        const response = await axios.get(categoryUrl, {
            headers: {
                'Cookie': cookies
            }
        });

        const $ = cheerio.load(response.data);
        
        // Ищем первую ссылку на оффер
        const offerLink = $('.tc-item').first().attr('href');
        if (!offerLink) {
            console.log(chalk.yellow('⚠ Офферы не найдены'));
            return null;
        }

        // Извлекаем ID оффера из ссылки
        const offerMatch = offerLink.match(/offer=(\d+)/);
        if (!offerMatch) {
            console.log(chalk.yellow('⚠ ID оффера не найден в ссылке'));
            return null;
        }

        const offerId = offerMatch[1];
        console.log(chalk.green('✓ Найден оффер:', chalk.yellow(offerId)));
        return offerId;
    } catch (error) {
        console.log(chalk.red('✗ Ошибка при поиске оффера:', error.message));
        return null;
    }
}

// Функция для получения данных формы из существующего оффера
async function getOfferFormData(offerId, categoryId, cookies) {
    try {
        const url = `https://funpay.com/lots/offerEdit?node=${categoryId}&offer=${offerId}`;
        console.log(chalk.blue('ℹ'), 'URL формы:', chalk.underline(url));

        const response = await axios.get(url, {
            headers: {
                'Cookie': cookies
            }
        });

        return cheerio.load(response.data);
    } catch (error) {
        console.log(chalk.red('✗ Ошибка при получении данных формы:', error.message));
        return null;
    }
}

// Функция задержки
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Основная функция
async function main() {
    try {
        // Читаем конфигурацию
        const config = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
        const cookies = config.cookies;

        // Читаем офферы из файла
        const offersData = JSON.parse(fs.readFileSync(path.join(__dirname, '../differenceBetweenOffers/user_2.json'), 'utf8'));

        // Фильтруем только нужные категории и убираем дубликаты
        const categories = [...new Set(offersData
            .filter(offer => ["1127", "1142", "1560", "965"].includes(offer.node_id))
            .map(offer => offer.node_id))]
            .map(id => ({
                id: id,
                name: offersData.find(offer => offer.node_id === id)?.name || 'Неизвестная категория'
            }));

        console.log(chalk.cyan('\n→ Обработка категорий:'));
        for (const category of categories) {
            console.log(chalk.yellow(`Найдена категория ${category.name} (ID: ${category.id})`));
        }

        // Читаем существующие шаблоны если они есть
        let templates = {};
        const templatesPath = path.join(__dirname, 'form_templates.json');
        try {
            if (fs.existsSync(templatesPath)) {
                templates = JSON.parse(fs.readFileSync(templatesPath, 'utf8'));
            }
        } catch (error) {
            console.log(chalk.red('✗ Ошибка при чтении существующего JSON:', error));
        }

        // Обрабатываем каждую категорию
        for (const category of categories) {
            console.log(chalk.cyan('\n→ Обработка категории'), chalk.yellow(category.name), 
                       chalk.cyan('(ID:'), chalk.yellow(category.id), chalk.cyan(')'));

            const $ = await getFormMetadata(category.id, cookies);
            if (!$) {
                console.log(chalk.red('✗ Не удалось получить данные формы'));
                continue;
            }

            const categoryName = $('.page-header').text().trim();
            console.log(chalk.green(`\n✓ Получены данные для категории: ${chalk.yellow(categoryName)}`));

            const formData = {};

            const fieldsToFind = [
                'csrf_token',
                'node_id',
                'server_id',
                'side_id',
                'fields[method]',
                'fields[game]',
                'fields[quantity]',
                'fields[type]',
                'fields[type2]',
                'fields[type3]',
                'fields[brawlpass]',
                'fields[summary][ru]',
                'fields[summary][en]',
                'fields[desc][ru]',
                'fields[desc][en]',    
                'amount', 
                'active',
                'price',
            ];

            console.log(chalk.cyan('\n→ Поиск полей формы:'));
            fieldsToFind.forEach(fieldName => {
                const field = $(`[name="${fieldName}"]`);
                if (field.length) {
                    console.log(`${chalk.green('✓')} ${chalk.yellow(fieldName)}`);
                    formData[fieldName] = '';
                } else {
                    console.log(`${chalk.red('✗')} ${chalk.yellow(fieldName)} - поле не найдено`);
                }
            });

            // Добавляем обязательные поля если их нет
            const requiredFields = ['csrf_token', 'node_id', 'active', 'price'];
            requiredFields.forEach(field => {
                if (!formData[field]) {
                    formData[field] = '';
                    console.log(`${chalk.blue('+')} ${chalk.yellow(field)} - добавлено как обязательное поле`);
                }
            });

            console.log(chalk.cyan('\n→ Сформированный шаблон:'));
            for (const key of Object.keys(formData)) {
                if (key === 'node_id') {
                    console.log(chalk.yellow(key) + ': ');
                } else {
                    console.log(chalk.blue(key));
                }
            }

            // Добавляем шаблон в общий объект
            templates[category.id] = formData;

            // Добавляем задержку между запросами
            await delay(2000);
        }

        // Сохраняем все шаблоны в JSON
        fs.writeFileSync(
            templatesPath,
            JSON.stringify(templates, null, 2),
            'utf8'
        );
        console.log(chalk.green('\n✓ Все шаблоны сохранены в', chalk.yellow('form_templates.json')));

    } catch (error) {
        console.log(chalk.red('\n✗ Ошибка:', error.message));
    }
}

main();
