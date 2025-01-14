// Вспомогательная функция для форматирования описания
import { FunPayFormProcessor } from './form_data_processor.js';
import templates from './form_templates.json' assert { type: 'json' };
import { calculatePrice } from './price_calculator.js';

// Функция для извлечения значений полей из опций
function extractFieldValue(template, fieldName, offer) {
    console.log(`\nExtracting ${fieldName}:`);
    console.log('Template field:', template[fieldName]);
    console.log('Offer:', offer);
    console.log('Offer options:', offer.options);
    
    if (!template[fieldName]) return ' ';
    if (!offer.options) return ' ';
    
    // Разбиваем options на массив и очищаем от пробелов
    const optionsArray = offer.options.split(',').map(opt => opt.trim());
    console.log('Options array:', optionsArray);
    
    const entries = Object.entries(template[fieldName]);
    console.log('Entries:', entries);
    
    const foundEntry = entries.find(([_, value]) => {
        return optionsArray.includes(value);
    });
    
    const result = foundEntry ? foundEntry[0] : ' ';
    console.log('Result:', result);
    return result;
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
                };

                // Специфичная логика для каждой категории
                switch(nodeId) {
                    case "965": // Алмазы Boom Beach
                        return {
                            ...formData,
                            'fields[quantity]': offer.descText,
                            'fields[desc][ru]': config.descRu,
                            'fields[payment_msg][ru]': ' ',
                            price: calculatePrяёice("965", offer.price),
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
                            deactivate_after_sale: ' ',
                            price: calculatePrice("1127", offer.price)
                        };

                    case "1130": // ROYAL
                        return {
                            ...formData,
                            'fields[method]': extractFieldValue(template, 'fields[method]', offer),
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[desc][ru]': config.descRu,
                            deactivate_after_sale: ' ',
                            price: calculatePrice("1130", offer.price),
                            amount: '999'
                        };

                    case "1129": // CLANS
                        return {
                            ...formData,
                            'fields[method]': extractFieldValue(template, 'fields[method]', offer),
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[desc][ru]': config.descRu,
                            deactivate_after_sale: ' ',
                            price: calculatePrice("1129", offer.price),
                            amount: '999'
                        };
    
                    case "1135": // RAID
                        return {
                            ...formData,
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': FunPayFormProcessor.formatDescription(offer.descTextEn),
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': config.descEn,
                            price: calculatePrice("1135", offer.price),
                            amount: '999'
                        };
                    case "1697": // MORTAL
                        return {
                            ...formData,
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[quantity]' : extractFieldValue(template, 'fields[quantity]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': FunPayFormProcessor.formatDescription(offer.descTextEn),
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': config.descEn,
                            price: calculatePrice("1697", offer.price),
                            deactivate_after_sale: ' ',
                        };
                    case "1755": // MORTAL
                        return {
                            ...formData,
                            'fields[topup]': extractFieldValue(template, 'fields[topup]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[desc][ru]': config.descRu,
                            price: calculatePrice("1755", offer.price),
                            deactivate_after_sale: ' ',
                            amount: '999'
                        };
                    case "609": // STAR
                        return {
                            ...formData,
                            'server_id': "3845",
                            'side_id': "66",
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': FunPayFormProcessor.formatDescription(offer.descTextEn),
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': config.descEn,
                            price: calculatePrice("609", offer.price),
                            deactivate_after_sale: ' ',
                            amount: '999'
                        };  
                    case "1523": // FC
                        return {
                            ...formData,
                            'fields[type]': extractFieldValue(template, 'fields[type]', offer),
                            'fields[summary][ru]': FunPayFormProcessor.formatDescription(offer.descText),
                            'fields[summary][en]': FunPayFormProcessor.formatDescription(offer.descTextEn),
                            'fields[desc][ru]': config.descRu,
                            'fields[desc][en]': config.descEn,
                            price: calculatePrice("1523", offer.price),
                            deactivate_after_sale: ' ',
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
    "1127": generateTemplateFromJson("1127"), // Brawl Stars
    "1130": generateTemplateFromJson("1130"),
    "1129": generateTemplateFromJson("1129"),
    "1135": generateTemplateFromJson("1135"),
    "1697": generateTemplateFromJson("1697"),
    "1755": generateTemplateFromJson("1755"),
    "609": generateTemplateFromJson("609"),
    "1523": generateTemplateFromJson("1523")
};

// Функция для получения шаблона формы по ID категории
export function getFormTemplate(categoryId) {
    return formTemplates[categoryId] || null;
}
