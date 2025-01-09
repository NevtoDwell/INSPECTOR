// Вспомогательная функция для форматирования описания
import { FunPayFormProcessor } from './form_data_processor.js';
import templates from './form_templates.json' assert { type: 'json' };
import { calculatePrice } from './price_calculator.js';

// Функция для извлечения значений полей из опций
function extractFieldValue(template, fieldName, offer) {
    if (!template[fieldName]) return ' ';
    return Object.keys(template[fieldName])
        .find(value => offer.options?.includes(value)) || ' ';
}

// Функция для генерации шаблона из JSON
function generateTemplateFromJson(nodeId) {
    try {
        const template = templates[nodeId];
        
        if (!template) {
            console.error(`Template not found for node ID: ${nodeId}`);
            return null;
        }

        return {
            getFormData: (offer, config) => {
                // Базовые поля для всех категорий
                const formData = {
                    csrf_token: config.csrf_token,
                    node_id: offer.node_id,
                    active: 'on',
                    deactivate_after_sale: ' '
                };

                // Специфичная логика для каждой категории
                switch(nodeId) {
                    case "965": // Алмазы Boom Beach
                        return {
                            ...formData,
                            'fields[quantity]': offer.descText,
                            'fields[desc][ru]': config.descRu,
                            'fields[payment_msg][ru]': ' ',
                            price: calculatePrice("965", offer.price),
                            amount: '999'
                        };

                    case "1142": // Arknights
                        return {
                            ...formData,
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': FunPayFormProcessor.formatDescription(offer.descTextEn),
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': config.descEn,
                            'fields[payment_msg][ru]': ' ',
                            'fields[payment_msg][en]': ' ',
                            price: calculatePrice("1142", offer.price),
                            amount: '999'
                        };

                    case "1560": // Asphalt
                        return {
                            ...formData,
                            server_id: '9074',
                            'fields[method]': extractFieldValue(template, 'fields[method]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': '',
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': '',
                            'fields[payment_msg][ru]': ' ',
                            'fields[payment_msg][en]': ' ',
                            'fields[images]': '',
                            price: calculatePrice("1560", offer.price)
                        };

                    case "1127": // Brawl Stars
                        return {
                            ...formData,
                            'fields[method]': extractFieldValue(template, 'fields[method]', offer),
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[type2]': extractFieldValue(template, 'fields[type2]', offer),
                            'fields[brawlpass]': extractFieldValue(template, 'fields[brawlpass]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[desc][ru]': config.descRu,
                            price: calculatePrice("1127", offer.price)
                        };

                    default:
                        console.error(`Unknown node ID: ${nodeId}`);
                        return null;
                }
            }
        };
    } catch (error) {
        console.error('Error generating template:', error);
        return null;
    }
}

export const formTemplates = {
    "1142": generateTemplateFromJson("1142"), // Arknights
    "1560": generateTemplateFromJson("1560"), // Asphalt
    "965": generateTemplateFromJson("965"),   // Boom Beach
    "1127": generateTemplateFromJson("1127")  // Brawl Stars
};

// Функция для получения шаблона формы по ID категории
export function getFormTemplate(categoryId) {
    return formTemplates[categoryId] || null;
}
