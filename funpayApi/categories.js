import cheerio from 'cheerio';
import { getConst } from '../utils/constants.js';
import { log } from '../utils/logger.js';
import { headers } from './funpayApi.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getAllCategories(id) {
    let result = [];
    try {
        const options = {
            method: 'GET',
            headers: headers
        };

        const resp = await fetch(`${getConst('api')}/users/${id}/`, options);
        const body = await resp.text();

        const $ = cheerio.load(body);
        
        $('.game-title').each((i, el) => {
            const element = $(el);
            const link = element.find('a').attr('href');
            const nodeId = link.split('/').filter(Boolean).pop();
            
            result.push({
                name: element.find('a').text(),
                game_id: element.attr('data-id'),
                node_id: nodeId
            });
        });
        
    } catch (err) {
        log(`Ошибка при получении категорий: ${err}`, 'r');
    }
    return result;
}

async function saveCategoriesData(userId) {
    try {
        const categoriesData = await getAllCategories(userId);
        
        const jsonPath = path.join(__dirname, 'categories.json');
        await fs.writeFile(jsonPath, JSON.stringify(categoriesData, null, 2));
        log('Категории успешно сохранены в categories.json', 'g');
        
        return categoriesData;
    } catch (err) {
        log(`Ошибка при сохранении категорий: ${err}`, 'r');
        return [];
    }
}

export {
    getAllCategories,
    saveCategoriesData
};
