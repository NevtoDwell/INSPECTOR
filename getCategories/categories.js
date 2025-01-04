import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function saveCategoriesData() {
    try {
        // Получаем HTML страницы продавца
        const response = await axios.get('https://funpay.com/users/292020/');
        const html = response.data;
        
        const $ = cheerio.load(html);
        const categories = [];

        // Находим все заголовки категорий
        $('.offer-list-title').each((_, titleElement) => {
            const linkElement = $(titleElement).find('h3 a');
            const categoryName = linkElement.text().trim();
            const href = linkElement.attr('href');
            
            // Извлекаем node_id из href
            const node_id = href ? href.split('/')[4] : null;

            categories.push({
                name: categoryName,
                node_id: node_id
            });
        });

        // Сохраняем в JSON файл
        const jsonPath = path.join(__dirname, 'categories.json');
        await fs.writeFile(jsonPath, JSON.stringify(categories, null, 2));
        console.log('Categories saved to categories.json');

        return categories;

    } catch (error) {
        console.error('Error fetching categories:', error);
        throw error;
    }
}
