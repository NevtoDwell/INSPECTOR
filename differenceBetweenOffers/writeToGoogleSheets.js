import { google } from 'googleapis';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Константы для форматирования
const FORMAT_CONFIGS = {
  DEFAULT: {
    textFormat: {
      fontFamily: 'Roboto',
      fontSize: 10
    }
  },
  HEADER: {
    backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
    textFormat: {
      fontFamily: 'Roboto',
      bold: true,
      foregroundColor: { red: 1, green: 1, blue: 1 },
      fontSize: 10,
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
  // Очищаем все содержимое и форматирование
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: SPREADSHEET_ID,
    resource: {
      requests: [
        {
          updateCells: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
            },
            fields: '*' // Очищаем все поля
          }
        },
        {
          repeatCell: {
            range: {
              sheetId: sheetId,
              startRowIndex: 0,
            },
            cell: {
              userEnteredFormat: FORMAT_CONFIGS.DEFAULT
            },
            fields: 'userEnteredFormat.textFormat(fontFamily,fontSize)'
          }
        }
      ]
    }
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

function formatPrice(price) {
  if (!price) return '';
  // Извлекаем только числа из строки
  const number = price.toString().replace(/[^\d.]/g, '');
  return parseFloat(number);
}

async function writeToGoogleSheets() {
  try {
    // Инициализация Google Sheets API
    const sheets = await initializeGoogleSheets();

    // Чтение всех необходимых данных
    const [differences, profileNames, offersToAdd, additionalLots] = await Promise.all([
      JSON.parse(fs.readFileSync(join(__dirname, 'differences.json'), 'utf-8')),
      JSON.parse(fs.readFileSync(join(__dirname, 'profile_names.json'), 'utf-8')),
      JSON.parse(fs.readFileSync(join(__dirname, 'offers_to_add.json'), 'utf-8')),
      JSON.parse(fs.readFileSync(join(__dirname, 'additional_lots.json'), 'utf-8'))
    ]);

    // Создаем Map для быстрого поиска ссылок
    const linkMap = new Map();
    profileNames.forEach(item => {
      if (item.title) {
        linkMap.set(item.title.toLowerCase(), item.offerLink);
      }
    });

    // Получение информации о листах
    const { data: { sheets: sheetsList } } = await sheets.spreadsheets.get({ spreadsheetId: SPREADSHEET_ID });
    const differenceSheet = sheetsList.find(sheet => sheet.properties.title === 'DIFFERENCE');
    const needAddSheet = sheetsList.find(sheet => sheet.properties.title === 'NEED ADD');
    const additionalSheet = sheetsList.find(sheet => sheet.properties.title === 'ADDITIONAL');

    if (!differenceSheet || !needAddSheet || !additionalSheet) {
      throw new Error('Required sheets not found');
    }

    // Очищаем все листы перед записью новых данных
    await Promise.all([
      clearSheet(sheets, differenceSheet.properties.sheetId),
      clearSheet(sheets, needAddSheet.properties.sheetId),
      clearSheet(sheets, additionalSheet.properties.sheetId)
    ]);

    // Подготовка данных для DIFFERENCE
    const headers = [
      'Type', 
      'Title',
      'Price [RusyaSmile]', 
      'Price [BestRmtShop]', 
      'Difference',
      'Link'
    ];

    const rows = differences.map(item => {
      if (item.differenceType === '✅✅✅ SAME') {
        return [
          item.differenceType,
          item.title,
          formatPrice(item.price1Rusya),
          formatPrice(item.price2BestRmt),
          formatPrice(item.priceDifference),
          item.offerLink || ''
        ];
      }
      return [
        item.differenceType,
        item.title,
        formatPrice(item.price),
        '',
        '',
        item.offerLink || ''
      ];
    });

    // Очистка и запись данных DIFFERENCE
    await Promise.all([
      sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'DIFFERENCE!A:F',
      }),
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'DIFFERENCE!A1',
      valueInputOption: 'USER_ENTERED', // Важно для работы HYPERLINK
      resource: { values: [headers, ...rows] },
    });

    // Форматируем колонку со ссылками
    const formatLinkColumn = {
      repeatCell: {
        range: {
          sheetId: differenceSheet.properties.sheetId,
          startRowIndex: 1,
          startColumnIndex: 5,
          endColumnIndex: 6,
        },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 1, green: 1, blue: 1 }, // Белый фон
            textFormat: {
              fontFamily: 'Roboto',
              fontSize: 10,
              foregroundColor: { red: 0.06, green: 0.45, blue: 0.87 },
              underline: true
            },
            horizontalAlignment: 'CENTER',
            verticalAlignment: 'MIDDLE'
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)'
      }
    };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [formatLinkColumn]
      }
    });

    // Устанавливаем фиксированную ширину для всех столбцов
    const setColumnWidth = {
      updateDimensionProperties: {
        range: {
          sheetId: differenceSheet.properties.sheetId,
          dimension: 'COLUMNS',
          startIndex: 0,
          endIndex: 6
        },
        properties: {
          pixelSize: 150  // Фиксированная ширина в пикселях
        },
        fields: 'pixelSize'
      }
    };

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: {
        requests: [setColumnWidth]
      }
    });

    // Подготовка данных для NEED ADD
    const needAddHeaders = ['Title', 'Description', 'Price', 'Category ID'];
    const needAddRows = offersToAdd.map(item => [
      item.title,
      item.descText.split(',')[0],
      item.price,
      item.node_id || '',
    ]);

    // Очистка и запись данных NEED ADD
    await Promise.all([
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

    // Подготовка данных для ADDITIONAL
    const additionalHeaders = ['Title', 'Description', 'Price', 'Category ID'];
    const additionalRows = additionalLots.map(item => [
      item.title,
      item.descText,
      item.price,
      item.node_id || '',
    ]);

    // Очистка и запись данных ADDITIONAL
    await Promise.all([
      sheets.spreadsheets.values.clear({
        spreadsheetId: SPREADSHEET_ID,
        range: 'ADDITIONAL!A:D',
      }),
    ]);

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: 'ADDITIONAL!A1',
      valueInputOption: 'RAW',
      resource: { values: [additionalHeaders, ...additionalRows] },
    });

    // Форматирование всех листов
    await Promise.all([
      formatHeaders(sheets, differenceSheet.properties.sheetId, 6),
      formatHeaders(sheets, needAddSheet.properties.sheetId, 4),
      formatHeaders(sheets, additionalSheet.properties.sheetId, 4),
    ]);

    // Применяем форматирование к данным
    const formatRequests = [];
    
    // Форматирование строк данных
    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const backgroundColor = FORMAT_CONFIGS.ROW_TYPES[row[0]];
    
      if (backgroundColor) {
        // Форматируем все столбцы кроме Link
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: 5, // До столбца Link (не включая его)
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'RIGHT', // Выравнивание по правому краю для цен
                textFormat: { 
                  fontFamily: 'Roboto',
                  fontSize: 10 
                },
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,verticalAlignment,horizontalAlignment,textFormat,wrapStrategy)',
          },
        });

        // Форматируем первые два столбца (Type и Title) по левому краю
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: 2,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'LEFT', // Выравнивание по левому краю для текста
                textFormat: { 
                  fontFamily: 'Roboto',
                  fontSize: 10 
                },
                wrapStrategy: 'WRAP',
              },
            },
            fields: 'userEnteredFormat(backgroundColor,verticalAlignment,horizontalAlignment,textFormat,wrapStrategy)',
          },
        });
      }
    
      // Подсветка большой разницы в цене
      if (row[4] && parseFloat(row[4]) > 100) {
        formatRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 4,
              endColumnIndex: 5,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0, blue: 0 },
                textFormat: {
                  fontFamily: 'Roboto',
                  fontSize: 10,
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
                fontFamily: 'Roboto',
                fontSize: 10,
              },
              wrapStrategy: 'WRAP',
            },
          },
          fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat,wrapStrategy)',
        },
      });
    }

    // Форматируем столбцы с ценами
    const numberFormatRequests = {
      repeatCell: {
        range: {
          sheetId: differenceSheet.properties.sheetId,
          startRowIndex: 1,
          endRowIndex: rows.length + 1,
          startColumnIndex: 2,
          endColumnIndex: 5,
        },
        cell: {
          userEnteredFormat: {
            numberFormat: {
              type: 'NUMBER',
              pattern: '# ##0" ₽"'
            }
          }
        },
        fields: 'userEnteredFormat.numberFormat'
      }
    };

    formatRequests.push(numberFormatRequests);

    // Применяем все форматирование за один запрос
    if (formatRequests.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: { requests: formatRequests },
      });
    }

    // Форматирование листа ADDITIONAL фиолетовым цветом
    if (additionalRows.length > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SPREADSHEET_ID,
        resource: {
          requests: [{
            repeatCell: {
              range: {
                sheetId: additionalSheet.properties.sheetId,
                startRowIndex: 1, // Начинаем с первой строки после заголовка
                endRowIndex: additionalRows.length + 1,
                startColumnIndex: 0,
                endColumnIndex: 4,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.8, green: 0.6, blue: 1 }, // Фиолетовый цвет
                  verticalAlignment: 'MIDDLE',
                  textFormat: { 
                    fontFamily: 'Roboto',
                    fontSize: 10,
                  },
                  wrapStrategy: 'WRAP',
                },
              },
              fields: 'userEnteredFormat(backgroundColor,verticalAlignment,textFormat,wrapStrategy)',
            },
          }],
        },
      });
    }

    console.log(chalk.green.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.green('✓ Данные успешно записаны'));

  } catch (error) {
    console.log(chalk.red.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.red('✗ Ошибка: ') + error.message);
    process.exit(1);
  }
}

writeToGoogleSheets();