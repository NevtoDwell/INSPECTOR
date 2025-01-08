// Вспомогательная функция для форматирования описания
import { formatDescription } from './form_data_processor.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Читаем шаблоны из JSON
const templateFields = JSON.parse(fs.readFileSync(path.join(__dirname, 'form_templates.json'), 'utf8'));

// Функция для генерации шаблона из JSON
function generateTemplateFromJson(nodeId) {
    const template = templateFields[nodeId];
    if (!template) return null;

    return {
        getFormData: (offer, config) => {
            const formData = {};
            
            // Проходим по всем полям из JSON и добавляем их
            for (const [key, value] of Object.entries(template)) {
                switch(key) {
                    case 'csrf_token':
                        formData[key] = config.csrf_token;
                        break;
                    case 'node_id':
                        formData[key] = offer.node_id;
                        break;
                    case 'fields[method]':
                        formData[key] = 'С заходом на аккаунт';
                        break;
                    case 'fields[summary][ru]':
                        formData[key] = formatDescription(offer.descText);
                        break;
                    // case 'fields[summary][en]':
                    //     formData[key] = formatDescription(offer.descTextEn);
                    //     break;
                    case 'fields[desc][ru]':
                        formData[key] = config.descRu;
                        break;
                    // case 'fields[desc][en]':
                    //     formData[key] = config.descEn;
                    //     break;
                    case 'price':
                        formData[key] = offer.price;
                        break;
                    case 'active':
                        formData[key] = 'on';
                        break;
                    case 'fields[type]':
                        formData[key] = 'Скины';
                        break;
                    case 'fields[type2]':
                        formData[key] = 'Официально (рекомендуется)';
                        break;
                    default:
                        formData[key] = '';
                }
            }
            
            return formData;
        }
    };
}

export const formTemplates = {
    "1142": { // Arknights
        getFormData: (offer, config) => ({
            csrf_token: config.csrf_token,
            node_id: offer.node_id,
            'fields[type]': 'Паки',
            'fields[summary][ru]': formatDescription(offer.descText),
            'fields[summary][en]': formatDescription(offer.descTextEn),
            'fields[desc][ru]': config.descRu,
            'fields[desc][en]': config.descEn,
            'fields[payment_msg][ru]': ' ',
            'fields[payment_msg][en]': ' ',
            price: offer.price,
            amount: '999',
            active: 'on'
        })
    },
    "1560": { // Asphalt
        getFormData: (offer, config) => {
            const originalPrice = parseFloat(offer.price.replace(/[^\d.]/g, ''));
            const increasedPrice = Math.round(originalPrice / 1.10);
            
            console.log(' Исходная строка цены:', offer.price);
            console.log(' Очищенная цена:', originalPrice);
            console.log(' Рассчитанная цена:', increasedPrice);

            const formData = {
                csrf_token: config.csrf_token,
                node_id: offer.node_id,
                server_id: '9074',
                'fields[method]': 'С заходом на аккаунт',
                'fields[summary][ru]': formatDescription(offer.descText),
                'fields[summary][en]': '',
                'fields[desc][ru]': config.descRu,
                'fields[desc][en]': '',
                'fields[payment_msg][ru]': ' ',
                'fields[payment_msg][en]': ' ',
                'fields[images]': '',
                price: increasedPrice,
                deactivate_after_sale: '',
                active: 'on'
            };

            console.log(' Данные формы:', JSON.stringify(formData, null, 2));
            return formData;
        }
    },
    "965": { // Алмазы Boom Beach
        getFormData: (offer, config) => {
            const originalPrice = parseFloat(offer.price.replace(/[^\d.]/g, ''));
            const increasedPrice = Math.round(originalPrice / 1.058);
            
            console.log(' Исходная строка цены:', offer.price);
            console.log(' Очищенная цена:', originalPrice);
            console.log(' Рассчитанная цена:', increasedPrice);

            return {
                csrf_token: config.csrf_token,
                node_id: offer.node_id,
                'fields[quantity]': offer.descText,
                'fields[desc][ru]': config.descRu,
                'fields[payment_msg][ru]': ' ',
                price: increasedPrice,
                deactivate_after_sale: '',
                amount: '999',
                active: 'on'
            };
        }
    },
    "1127": generateTemplateFromJson("1127") // Донат Brawl Stars
};

// Функция для получения шаблона формы по ID категории
export function getFormTemplate(categoryId) {
    return formTemplates[categoryId] || null;
}
