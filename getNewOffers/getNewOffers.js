const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const chalk = require('chalk');

const url = process.argv[2];

if (!url) {
  console.error('URL не указан. Пожалуйста, передайте URL в качестве аргумента.');
  process.exit(1);
}

// Пути JSON-файлов
const currentOffersPath = path.join(__dirname, 'currentOffers.json');
const newOffersPath = path.join(__dirname, 'newOffers.json');
const historyPath = path.join(__dirname, 'newOffersHistory.json');

function ensureFileExists(filePath, initialContent = '[]') {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, initialContent);
    console.log(`Файл ${filePath} создан.`);
  }
}

function clearHistoryAtMidnight() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Очищаем историю, если время 00:00
  if (hours === 0 && minutes === 0) {
    fs.writeFileSync(historyPath, JSON.stringify([], null, 2));
    console.log(chalk.red('История очищена в 00:00.'));
  }
}

async function fetchOffers() {
  try {
    // Убедитесь, что файлы существуют
    ensureFileExists(currentOffersPath, JSON.stringify({ offers: [] }, null, 2));
    ensureFileExists(newOffersPath);
    ensureFileExists(historyPath);

    // Очищаем историю в полночь
    clearHistoryAtMidnight();

    // Загружаем страницу
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    // Собираем текущие офферы
    const currentItems = [];
    $('.tc-item').each((index, element) => {
      const descText = $(element).find('.tc-desc-text').text().trim();
      const price = $(element).find('.tc-price div').text().trim();
      const link = $(element).attr('href');
      const title = $(element).closest('.offer').find('.offer-list-title a').text().trim() || 'Неизвестный заголовок';

      currentItems.push({
        title,
        descText,
        price,
        link,
      });
    });

    // Читаем предыдущие офферы
    const previousData = JSON.parse(fs.readFileSync(currentOffersPath, 'utf8'));
    const previousItems = previousData.offers || [];

    // Читаем историю новых офферов
    const historyData = JSON.parse(fs.readFileSync(historyPath, 'utf8'));

    // Если currentOffers.json только что создан, то в истории ничего не добавляем
    const isFreshStart = previousItems.length === 0;

    // Сравниваем и ищем новые офферы
    const newOffers = currentItems.filter(item =>
      !previousItems.some(prev => prev.link === item.link)
    );

    // Сохраняем новые офферы
    if (!isFreshStart && newOffers.length > 0) {
      // Добавляем новые офферы в историю
      const updatedHistory = [...historyData, ...newOffers];
      fs.writeFileSync(historyPath, JSON.stringify(updatedHistory, null, 2));

      // Обновляем файл newOffers.json
      fs.writeFileSync(newOffersPath, JSON.stringify(newOffers, null, 2));
      console.log(`Новые офферы (${newOffers.length}) сохранены в ${newOffersPath} и добавлены в историю.`);
    } else if (isFreshStart) {
      console.log('Первый запуск: текущие офферы в историю не добавлены.');
    } else {
      console.log('Новых офферов нет.');
    }

      




    


    // Обновляем файл с текущими офферами
    fs.writeFileSync(
      currentOffersPath,
      JSON.stringify({ offers: currentItems }, null, 2)
    );

  } catch (error) {
    console.error('Ошибка при извлечении данных:', error.message);
  }
}

fetchOffers();
