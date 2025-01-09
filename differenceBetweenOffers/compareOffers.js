import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Функция для чтения JSON-файла
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.log(chalk.yellow.bold('📄 JSON') + chalk.white(' → ') + chalk.red('✗ Ошибка чтения: ') + error.message);
    return [];
  }
}

// Функция для удаления смайликов, специальных символов и пробелов из текста
function cleanText(text) {
  return text
    .replace(/[\u{1F300}-\u{1FAD6}|\u{1F600}-\u{1F64F}|\u{1F680}-\u{1F6FF}|\u{2600}-\u{26FF}|\u{2700}-\u{27BF}|🔴|⚡|💎|✅|▪︎|<<|>>]/gu, '') // Убираем смайлики и символы
    .replace(/\s+/g, '') // Удаляем все пробелы
    .toLowerCase() // Приводим текст к нижнему регистру для гарантии
    .trim();
}

// Функция для фильтрации данных по категории (по заголовку)
function filterByTitle(data, title) {
  return data.filter((item) => item.title === title);
}

// Функция для преобразования цены в число
function parsePrice(price) {
  return parseFloat(price.replace(/[^\d.]/g, ''));
}

// Функция для получения текста до первой запятой
function getTextBeforeComma(text) {
  return text.split(',')[0];
}

// Функция для поиска различий без дублирования
function findUniqueDifferences(array1, array2) {
  const differences = [];
  const processedDescriptions = new Set();

  array1.forEach((item1) => {
    const cleanedDesc1 = cleanText(item1.descText);
    const key1 = `${cleanedDesc1}_${item1.node_id}`; // Добавляем node_id к ключу

    if (processedDescriptions.has(key1)) return;

    const matchingItem = array2.find((item2) => {
      const cleanedDesc2 = cleanText(item2.descText);
      return cleanedDesc1 === cleanedDesc2 && item1.node_id === item2.node_id; // Проверяем совпадение node_id
    });

    if (matchingItem) {
      const price1 = parsePrice(item1.price);
      const price2 = parsePrice(matchingItem.price);
      const priceDifference = Math.abs(price1 - price2).toFixed(2);

      differences.push({
        differenceType: cleanedDesc1 === cleanText(matchingItem.descText) ? '✅✅✅ SAME' : '❌❌❌ DIFFERENT',
        title: item1.title,
        descText1: getTextBeforeComma(item1.descText),
        descText2: getTextBeforeComma(matchingItem.descText),
        descTextEn1: item1.descTextEn || '',
        descTextEn2: matchingItem.descTextEn || '',
        price1Rusya: item1.price,
        price2BestRmt: matchingItem.price,
        priceDifference: `${priceDifference} ₽`,
        node_id: item1.node_id || '',
        offerLink1: item1.offerLink || '',
        offerLink2: matchingItem.offerLink || '',
        options1: item1.options || 'С заходом на аккаунт',
        options2: matchingItem.options || 'С заходом на аккаунт'
      });
    } else {
      differences.push({
        differenceType: '❌❌❌ ADD ME',
        title: item1.title,
        descText: getTextBeforeComma(item1.descText),
        descTextEn: item1.descTextEn || '',
        price: item1.price,
        node_id: item1.node_id || '',
        offerLink: item1.offerLink || '',
        options: item1.options || 'С заходом на аккаунт'
      });
    }

    processedDescriptions.add(key1);
  });

  // Проверяем офферы, которых нет у первого пользователя
  array2.forEach((item2) => {
    const cleanedDesc2 = cleanText(item2.descText);
    const key2 = `${cleanedDesc2}_${item2.node_id}`; // Добавляем node_id к ключу

    if (!processedDescriptions.has(key2)) {
      differences.push({
        differenceType: '➕➕➕ ADDITIONAL LOT',
        title: item2.title,
        descText: getTextBeforeComma(item2.descText),
        descTextEn: item2.descTextEn || '',
        price: item2.price,
        node_id: item2.node_id || '',
        offerLink: item2.offerLink || '',
        options: item2.options || 'С заходом на аккаунт'
      });
    }
  });

  return differences;
}

// Основной процесс
async function compareFiles() {
  const user1Data = readJSON(join(__dirname, 'user_1.json'));
  const user2Data = readJSON(join(__dirname, 'user_2.json'));
  
  const differences = findUniqueDifferences(user1Data, user2Data);
  
  try {
    // Сохраняем все различия
    fs.writeFileSync(
      join(__dirname, 'differences.json'),
      JSON.stringify(differences, null, 2),
      'utf-8'
    );
    
    // Создаем список офферов для добавления
    const offersToAdd = differences
      .filter(diff => diff.differenceType === '❌❌❌ ADD ME')
      .map(diff => ({
        title: diff.title,
        descText: diff.descText,
        descTextEn: diff.descTextEn || '',
        price: diff.price,
        node_id: diff.node_id,
        offerLink: diff.offerLink || '',
        options: diff.options
      }));
    
    fs.writeFileSync(
      join(__dirname, 'offers_to_add.json'),
      JSON.stringify(offersToAdd, null, 2),
      'utf-8'
    );

    // Выводим количество офферов в stdout
    console.log(`OFFERS_TO_ADD:${offersToAdd.length}`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

compareFiles();
