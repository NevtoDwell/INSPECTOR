// Вспомогательная функция для форматирования описания
import { FunPayFormProcessor } from './form_data_processor.js';
import templates from './form_templates.json' assert { type: 'json' };
import { calculatePrice } from './price_calculator.js';

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
                            deactivate_after_sale: '',
                            amount: '999'
                        };

                    case "1142": // Arknights
                        return {
                            ...formData,
                            'fields[type]': 'Паки',
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
                            'fields[method]': 'С заходом на аккаунт',
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': '',
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': '',
                            'fields[payment_msg][ru]': ' ',
                            'fields[payment_msg][en]': ' ',
                            'fields[images]': '',
                            price: calculatePrice("1560", offer.price),
                            deactivate_after_sale: ''
                        };

                    case "1127": // Brawl Stars
                        // Находим значения из доступных опций
                        const typeValue = Object.keys(template['fields[type]'])
                            .find(type => offer.options?.includes(type));
                            
                        const methodValue = Object.keys(template['fields[method]'])
                            .find(method => offer.options?.includes(method));
                            
                        const type2Value = Object.keys(template['fields[type2]'])
                            .find(type2 => offer.options?.includes(type2));
                            
                        const brawlpassValue = Object.keys(template['fields[brawlpass]'])
                            .find(brawlpass => offer.options?.includes(brawlpass)) || ' ';
                            
                        return {
                            ...formData,
                            'fields[method]': methodValue,
                            'fields[type]': typeValue,
                            'fields[type2]': type2Value,
                            'fields[brawlpass]': brawlpassValue,
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
