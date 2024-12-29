const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const chalk = require("chalk")

const credentialsPath = path.join(__dirname, '..',  '..', 'api keys', 'credentials.json');



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
    console.log(chalk.yellow('Начало работы с файлом newOffersHistory.json...'));

    if (!fs.existsSync('getNewOffers/newOffersHistory.json')) {
      console.error('Файл newOffers.json не найден.');
      process.exit(1);
    }

    const offersData = JSON.parse(fs.readFileSync('getNewOffers/newOffersHistory.json', 'utf8'));
    console.log(`Файл newOffers.json успешно загружен. Найдено офферов: ${offersData.length}`);

    const values = [
      [ 'CATEGORY', 'TEXT OFFER', 'PRICE', 'LINK'], // Заголовки таблицы
    ];

    offersData.forEach((offer, index) => {
    //   console.log(`Обрабатывается оффер ${index + 1}:`, offer);
      values.push([
        offer.title,
        offer.descText,
        offer.price,
        offer.link,
      ]);
    });

    console.log('Очистка старых данных...');
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: 'NEW OFFERS!A1:Z1000', // Укажите диапазон, который гарантированно покрывает все данные
    });

    const response = await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });
    applyStyles();
    console.log(chalk.green('Данные успешно записаны в таблицу. ' + range));
  } catch (error) {
    console.error('Ошибка записи в таблицу:', error.message);
  }
}

async function applyStyles() {
    try {
      const requests = [
        {
          repeatCell: {
            range: {
              sheetId: 799669749,
              startRowIndex: 0,
              endRowIndex: 1,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 255 / 255, green: 217 / 255, blue: 103 / 255 }, 
                textFormat: {
                  fontSize: 12,
                  bold: true,
                  fontFamily: 'Montserrat',
                  foregroundColor: { red: 20 / 255, green: 4 / 255, blue: 0 / 255 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
          
        },
        {
          repeatCell: {
            range: {
              sheetId: 799669749,
              startRowIndex: 1,
              endRowIndex: 2,
              startColumnIndex: 0,
              endColumnIndex: 1,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.992, green: 0.894, blue: 0.804 },
                textFormat: {
                  fontSize: 12,
                  bold: true,
                  fontFamily: 'Montserrat',
                  foregroundColor: { red: 20 / 255, green: 4 / 255, blue: 0 / 255 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
          
        },
        {
          repeatCell: {
            range: {
              sheetId: 799669749,
              startRowIndex: 3,
              endRowIndex: 4,
              startColumnIndex: 0,
              endColumnIndex: 4,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.992, green: 0.894, blue: 0.804 },
                textFormat: {
                  fontSize: 12,
                  bold: true,
                  fontFamily: 'Montserrat',
                  foregroundColor: { red: 20 / 255, green: 4 / 255, blue: 0 / 255 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
        {
          repeatCell: {
            range: {
              sheetId: 799669749, 
              startRowIndex: 4, 
              startColumnIndex: 0, 
              endColumnIndex: null, 
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 1, blue: 1 }, 
                textFormat: {
                  fontSize: 10,
                  bold: false, 
                  fontFamily: 'Roboto', 
                  foregroundColor: { red: 0, green: 0, blue: 0 }, 
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        },
      ];
  
      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests,
        },
      });
    } catch (error) {
      console.error('Ошибка при применении стилей:', error);
    }
  }

writeToSheet();
