import { google } from 'googleapis';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function writeToGoogleSheets() {
  try {
    const differencesPath = join(__dirname, 'differences.json');
    const differences = JSON.parse(fs.readFileSync(differencesPath, 'utf-8'));

    // Читаем имена профилей
    const profileNamesPath = join(__dirname, 'profile_names.json');
    const profileNames = JSON.parse(fs.readFileSync(profileNamesPath, 'utf-8'));

    const auth = new google.auth.GoogleAuth({
      keyFile: join(__dirname, '..', '..', 'api keys', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const spreadsheetId = '1vMm_FHnUp1xH-07OoOr2BQIRKkOoVG0r1yKff82xVUw';

    // Подготовка данных
    const headers = [
      'Difference Type', 
      'Title', 
      `Description (${profileNames.user_1})`, 
      `Description (${profileNames.user_2})`, 
      `Price (${profileNames.user_1})`, 
      `Price (${profileNames.user_2})`, 
      'Difference',
      'FunPay Category ID', // ID категории на FunPay
    ];
    const rows = differences.map(item => {
      if (item.differenceType === '✅✅✅ SAME') {
        return [
          item.differenceType,
          item.title,
          item.descText1.split(',')[0],
          item.descText2.split(',')[0],
          item.price1Rusya,
          item.price2BestRmt,
          item.priceDifference,
          item.node_id || '',  // FunPay Category ID
        ];
      } else {
        return [
          item.differenceType,
          item.title,
          item.descText.split(',')[0],
          '',
          item.price,
          '',
          '',
          item.node_id || '',  // FunPay Category ID
        ];
      }
    });

    // Получаем ID листа
    const sheetsResponse = await sheets.spreadsheets.get({ spreadsheetId });
    const differenceSheet = sheetsResponse.data.sheets.find(
      sheet => sheet.properties.title === 'DIFFERENCE'
    );
    
    if (!differenceSheet) {
      throw new Error('DIFFERENCE sheet not found');
    }

    const sheetId = differenceSheet.properties.sheetId;

    // Очистка форматирования и данных
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: sheetId,
                startRowIndex: 0,
                startColumnIndex: 0,
              },
              fields: 'userEnteredFormat',
            },
          },
        ],
      },
    });

    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'DIFFERENCE!A:H',
    });

    // Записываем данные в лист DIFFERENCE
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'DIFFERENCE!A1',
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] },
    });

    // Читаем офферы для добавления
    const offersToAddPath = join(__dirname, 'offers_to_add.json');
    const offersToAdd = JSON.parse(fs.readFileSync(offersToAddPath, 'utf-8'));

    // Подготовка данных для листа NEED ADD
    const needAddHeaders = [
      'Difference Type', 
      'Title', 
      'Description', 
      'Price', 
      'FunPay Category ID'
    ];
    const needAddRows = offersToAdd.map(item => [
      item.differenceType,
      item.title,
      item.descText.split(',')[0],
      item.price,
      item.node_id || ''
    ]);

    // Находим лист NEED ADD
    const needAddSheet = sheetsResponse.data.sheets.find(
      sheet => sheet.properties.title === 'NEED ADD'
    );
    
    if (!needAddSheet) {
      throw new Error('NEED ADD sheet not found');
    }

    const needAddSheetId = needAddSheet.properties.sheetId;

    // Очистка форматирования и данных для листа NEED ADD
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: {
        requests: [
          {
            updateCells: {
              range: {
                sheetId: needAddSheetId,
                startRowIndex: 0,
                startColumnIndex: 0,
              },
              fields: 'userEnteredFormat',
            },
          },
        ],
      },
    });

    // Очистка данных листа NEED ADD
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: 'NEED ADD',
    });

    // Записываем данные в лист NEED ADD
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'NEED ADD!A1:E',
      valueInputOption: 'RAW',
      resource: { values: [needAddHeaders, ...needAddRows] },
    });

    // Форматирование
    const requests = [
      // Форматирование заголовков
      {
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
              textFormat: {
                bold: true,
                foregroundColor: { red: 1, green: 1, blue: 1 },
                fontSize: 11,
              },
              horizontalAlignment: 'CENTER',
              verticalAlignment: 'MIDDLE',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      },
      // Автоматическая ширина столбцов
      {
        autoResizeDimensions: {
          dimensions: {
            sheetId: sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: 7,
          },
        },
      },
      // Закрепление заголовков
      {
        updateSheetProperties: {
          properties: {
            sheetId: sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      },
      // Оставляем только один базовый фильтр на весь диапазон
      {
        setBasicFilter: {
          filter: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
              endRowIndex: rows.length + 1,
              startColumnIndex: 0,
              endColumnIndex: 7,
            },
          },
        },
      },
    ];

    // Форматирование строк данных
    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      let backgroundColor;

      // Цвет фона в зависимости от типа различия
      switch (row[0]) {
        case '✅✅✅ SAME':
          backgroundColor = { red: 0.565, green: 0.933, blue: 0.565 };
          break;
        case '❌❌❌ ADD ME':
          backgroundColor = { red: 1, green: 0.8, blue: 0.8 };
          break;
        case '➕➕➕ ADDITIONAL LOT':
          backgroundColor = { red: 0.8, green: 0.6, blue: 1 };
          break;
      }

      // Добавляем форматирование строки
      requests.push({
        repeatCell: {
          range: {
            sheetId: sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
            startColumnIndex: 0,
            endColumnIndex: 7,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor,
              verticalAlignment: 'MIDDLE',
              textFormat: { fontSize: 10 },
              wrapStrategy: 'WRAP',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat,wrapStrategy)',
        },
      });

      // Проверяем описание на наличие ключевых слов и добавляем жёлтую подсветку
      const description = row[2] || ''; // Description колонка (индекс 2)
      if (description.toLowerCase().includes('под заказ') || description === '1') {
        requests.push({
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 2, // Description колонка
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.95, blue: 0.6 }, // Жёлтый цвет
                textFormat: {
                  bold: true, // Делаем текст жирным для лучшей видимости
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        });
      }

      // Выделение ячейки с большой разницей в цене
      if (row[6] && parseFloat(row[6]) > 100) {
        requests.push({
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 6,
              endColumnIndex: 7,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0, blue: 0 },
                textFormat: {
                  bold: true,
                  foregroundColor: { red: 1, green: 1, blue: 1 },
                },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        });
      }
    });

    // Применяем форматирование
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      resource: { requests },
    });

    console.log('Data successfully written and formatted in Google Sheets');
  } catch (error) {
    console.error('Error:', error.message);
  }
}

writeToGoogleSheets();