// Функция для расчета цены в зависимости от категории
export function calculatePrice(categoryId, originalPrice) {
    // Убираем все символы кроме цифр и точки из цены
    const price = parseFloat(originalPrice.replace(/[^\d.]/g, ''));
    
    switch(categoryId) {
        case "965": // Алмазы Boom Beach
            // Уменьшаем цену на 5.8%
            return Math.round(price / 1.058);
            
        case "1560": // Asphalt
            // Уменьшаем цену на 10%
            return Math.round(price / 1.10);
            
        case "1127": // Brawl Stars
            // Для Brawl Stars цена остается без изменений
            return Math.round(price / 1.1914);
        case "1142": // Arknights
            // Для Arknights цена остается без изменений
            return price;
        case "1130": // ROYAL
            return Math.round(price /  1.140);
        case "1129": // CLANS
            return Math.round(price /  1.140);
        case "1135": // RAID
            return Math.round(price /  1.17);
        case "1697": // MORTAL
            return Math.round(price /  1.099);
        case "1755": // ZOOBA
            return Math.round(price /  1.099);
        case "609": // STAR WARS
            return Math.round(price /  1.13);
        case "1523": // STAR WARS
            return Math.round(price /  1.187);
        default:
            // По умолчанию возвращаем оригинальную цену
            return price;
    }
}
