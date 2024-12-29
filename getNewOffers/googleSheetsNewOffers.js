const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const credentialsPath = path.join(__dirname, '..', '..', 'api keys', 'credentials.json');

if (!fs.existsSync(credentialsPath)) {
  console.error(`Файл credentials.json не найден по пути: ${credentialsPath}`);
  process.exit(1);
}

const credentials = JSON.parse(fs.readFileSync(credentialsPath, 'utf8'));

const auth = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  ['https://www.googleapis.com/auth/spreadsheets'],
  null
);

const sheets = google.sheets({ version: 'v4', auth });

const spreadsheetId = '1vMm_FHnUp1xH-07OoOr2BQIRKkOoVG0r1yKff82xVUw';
const range = 'NEW OFFERS!A1';

async function writeToSheet() {
  try {
    console.log(chalk.yellow('Начало работы с файлом currentOffers.json...'));

    // Проверяем, существует ли файл
    const currentOffersPath = path.join(__dirname, 'currentOffers.json');
    if (!fs.existsSync(currentOffersPath)) {
      console.error('Файл currentOffers.json не найден.');
      process.exit(1);
    }

    // Загружаем данные
    const offersData = JSON.parse(fs.readFileSync(currentOffersPath, 'utf8'));
    const profileName = offersData.profileName || 'Неизвестный профиль';
    const offers = offersData.offers || [];

    console.log(`Данные профиля: ${profileName}, найдено офферов: ${offers.length}`);

    // Подготавливаем данные для таблицы
    const values = [
      [`PROFILE NAME: ${profileName}`], // Имя профиля
      [], // Пустая строка для разделения
      ['CATEGORY', 'LINK', 'TITLE', 'PRICE'], // Заголовки таблицы
    ];

    // Добавляем офферы в таблицу
    offers.forEach((offer) => {
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item) => {
          values.push([
            offer.category || 'Без категории',
            offer.link || 'Нет ссылки',
            item.title || 'Нет названия',
            item.price || 'Нет цены',
          ]);
        });
      } else {
        values.push([
          offer.category || 'Без категории',
          offer.link || 'Нет ссылки',
          'Нет офферов',
          'N/A',
        ]);
      }
    });

    // Очищаем предыдущие данные
    console.log('Очистка старых данных...');
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'NEW OFFERS!A1:Z1000',
    });

    // Записываем новые данные
    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log(chalk.green('Данные успешно записаны в таблицу.'));
  } catch (error) {
    console.error('Ошибка записи в таблицу:', error.message);
  }
}

writeToSheet();
