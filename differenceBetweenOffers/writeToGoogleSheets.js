import { google } from 'googleapis';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Константы для форматирования
const FORMAT_CONFIGS = {
  HEADER: {
    backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
    textFormat: {
      bold: true,
      foregroundColor: { red: 1, green: 1, blue: 1 },
      fontSize: 11,
    },
    horizontalAlignment: 'CENTER',
    verticalAlignment: 'MIDDLE',
  },
  ROW_TYPES: {
    '✅✅✅ SAME': { red: 0.565, green: 0.933, blue: 0.565 },
    '❌❌❌ ADD ME': { red: 1, green: 0.8, blue: 0.8 },
    '➕➕➕ ADDITIONAL LOT': { red: 0.8, green: 0.6, blue: 1 },
  },
};

const SPREADSHEET_ID = '1vMm_FHnUp1xH-07OoOr2BQIRKkOoVG0r1yKff82xVUw';

async function initializeGoogleSheets() {
  const auth = new google.auth.GoogleAuth({
    keyFile: join(__dirname, '..', '..', 'api keys', 'credentials.json'),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return google.sheets({ version: 'v4', auth: await auth.getClient() });
}

async function clearSheet(sheets, sheetId) {
  const requests = [
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
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

async function formatHeaders(sheets, sheetId, endColumnIndex) {
  const requests = [
    {
      repeatCell: {
        range: {
          sheetId: sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        cell: {
          userEnteredFormat: FORMAT_CONFIGS.HEADER,
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
      },
    },
    {
      autoResizeDimensions: {
        dimensions: {
          sheetId: sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: endColumnIndex,
        },
      },
    },
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
  ];

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: { requests },
  });
}

async function writeToGoogleSheets() {
  try {
    // Инициализация Google Sheets API
    const sheets = await initializeGoogleSheets();

    // Чтение всех необходимых данных
    const [differences, profileNames, offersToAdd] = await Promise.all([
      JSON.parse(fs.readFileSync(join(__dirname, 'differences.json'), 'utf-8')),
      JSON.parse(fs.readFileSync(join(__dirname, 'profile_names.json'), 'utf-8')),
      JSON.parse(fs.readFileSync(join(__dirname, 'offers_to_add.json'), 'utf-8')),
    ]);

    // Получение информации о листах
    const { data: { sheets: sheetsList } } = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const differenceSheet = sheetsList.find(sheet => sheet.properties.title === 'DIFFERENCE');
    const needAddSheet = sheetsList.find(sheet => sheet.properties.title === 'NEED ADD');

    if (!differenceSheet || !needAddSheet) {
      throw new Error('Required sheets not found');
    }

    // Подготовка данных для DIFFERENCE
    const headers = [
      'Difference Type', 
      'Title', 
      `Description (${profileNames.user_1})`, 
      `Description (${profileNames.user_2})`, 
      `Price (${profileNames.user_1})`, 
      `Price (${profileNames.user_2})`, 
      'Difference',
      'FunPay Category ID',
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
          item.node_id || '',
        ];
      }
      return [
        item.differenceType,
        item.title,
        item.descText.split(',')[0],
        '',
        item.price,
        '',
        '',
        item.node_id || '',
      ];
    });

    // Очистка и запись данных DIFFERENCE
    await Promise.all([
      clearSheet(sheets, differenceSheet.properties.sheetId),
      sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DIFFERENCE!A:H',
      }),
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DIFFERENCE!A1',
      valueInputOption: 'RAW',
      resource: { values: [headers, ...rows] },
    });

    // Подготовка данных для NEED ADD
    const needAddHeaders = ['Title', 'Description', 'Price', 'FunPay Category ID'];
    const needAddRows = offersToAdd.map(item => [
      item.title,
      item.descText.split(',')[0],
      item.price,
      item.node_id || '',
    ]);

    // Очистка и запись данных NEED ADD
    await Promise.all([
      clearSheet(sheets, needAddSheet.properties.sheetId),
      sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'NEED ADD',
      }),
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'NEED ADD!A1:D',
      valueInputOption: 'RAW',
      resource: { values: [needAddHeaders, ...needAddRows] },
    });

    // Форматирование обоих листов
    await Promise.all([
      formatHeaders(sheets, differenceSheet.properties.sheetId, 8),
      formatHeaders(sheets, needAddSheet.properties.sheetId, 4),
    ]);

    // Применяем форматирование к данным
    const formatRequests = [];
    
    // Форматирование строк данных
    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const backgroundColor = FORMAT_CONFIGS.ROW_TYPES[row[0]];

      if (backgroundColor) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: 8,
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
      }

      // Подсветка "под заказ"
      const description = row[2] || '';
      if (description.toLowerCase().includes('под заказ') || description === '1') {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.95, blue: 0.6 },
                textFormat: { bold: true },
              },
            },
            fields: 'userEnteredFormat(backgroundColor,textFormat)',
          },
        });
      }

      // Подсветка большой разницы в цене
      if (row[6] && parseFloat(row[6]) > 100) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
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

    // Добавляем красное форматирование для всех ячеек в NEED ADD
    if (needAddRows.length > 0) {
      formatRequests.push({
        repeatCell: {
          range: {
            sheetId: needAddSheet.properties.sheetId,
            startRowIndex: 1, // Начинаем с первой строки после заголовка
            endRowIndex: needAddRows.length + 1,
            startColumnIndex: 0,
            endColumnIndex: 4,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 1, green: 0.8, blue: 0.8 }, // Красный цвет
              verticalAlignment: 'MIDDLE',
              textFormat: { 
                fontSize: 10,
              },
              wrapStrategy: 'WRAP',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat,wrapStrategy)',
        },
      });
    }

    // Применяем все форматирование за один запрос
    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: { requests: formatRequests },
      });
    }

    console.log(chalk.green.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.green('✓ Данные успешно записаны'));

  } catch (error) {
    console.log(chalk.red.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.red('✗ Ошибка: ') + error.message);
    process.exit(1);
  }
}

writeToGoogleSheets();