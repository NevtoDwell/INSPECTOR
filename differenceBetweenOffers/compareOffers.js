const fs = require('fs');
const path = require('path');

// Функция для чтения JSON-файла
function readJSON(filePath) {
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    console.error(`Ошибка при чтении файла ${filePath}:`, error.message);
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

    if (processedDescriptions.has(cleanedDesc1)) return;

    const matchingItem = array2.find((item2) => {
      const cleanedDesc2 = cleanText(item2.descText);
      return cleanedDesc1 === cleanedDesc2;
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
        price1Rusya: item1.price,
        price2BestRmt: matchingItem.price,
        priceDifference: `${priceDifference} ₽`,
      });
    } else {
      differences.push({
        differenceType: '❌❌❌ ADD ME',
        title: item1.title,
        descText: getTextBeforeComma(item1.descText),
        price: item1.price,
      });
    }

    processedDescriptions.add(cleanedDesc1);
  });

  // Проверяем офферы, которых нет у первого пользователя
  array2.forEach((item2) => {
    const cleanedDesc2 = cleanText(item2.descText);

    if (!processedDescriptions.has(cleanedDesc2)) {
      differences.push({
        differenceType: '➕➕➕ ADDITIONAL LOT',
        title: item2.title,
        descText: getTextBeforeComma(item2.descText),
        price: item2.price,
      });
    }
  });

  return differences;
}

// Основной процесс
function compareFiles() {
  const file1Path = path.join(__dirname, 'user_1.json');
  const file2Path = path.join(__dirname, 'user_2.json');
  const outputPath = path.join(__dirname, 'differences.json');

  const data1 = readJSON(file1Path);
  const data2 = readJSON(file2Path);

  // Фильтруем данные только для "Алмазы AFK Arena"
  // const filterName = "Донат Brawl Stars"
  
  // const filteredData1 = filterByTitle(data1, filterName);
  // const filteredData2 = filterByTitle(data2, filterName);

  // Находим различия
  const differences = findUniqueDifferences(data1, data2);

  // Записываем различия в файл
  fs.writeFileSync(outputPath, JSON.stringify(differences, null, 2), 'utf-8');
  console.log(`Различия сохранены в файл differences.json`);
}

compareFiles();
