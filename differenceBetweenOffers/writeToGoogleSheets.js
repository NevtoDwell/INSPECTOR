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
  // Проверяем, является ли цена строкой
  const priceStr = price.toString();
  // Сохраняем знак минуса, если он есть
  const isNegative = priceStr.startsWith('-');
  // Извлекаем числа из строки, сохраняя точку
  const number = priceStr.replace(/[^\d.]/g, '');
  // Возвращаем число с правильным знаком
  return isNegative ? -parseFloat(number) : parseFloat(number);
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
      'Link',
      'Price [RusyaSmile]', 
      'Price [BestRmtShop]', 
      'Difference'
    ];

    const rows = differences.map(item => {
      if (item.differenceType === '✅✅✅ SAME') {
        return [
          item.differenceType,
          item.title,
          item.offerLink2 || '',
          formatPrice(item.price1Rusya),
          formatPrice(item.price2BestRmt),
          formatPrice(item.priceDifference)
        ];
      }
      return [
        item.differenceType,
        item.title,
        item.offerLink2 || '',
        formatPrice(item.price),
        '',
        ''
      ];
    });

    // Подготовка данных для NEED ADD
    const needAddHeaders = ['Title', 'Description', 'Price'];
    const needAddRows = offersToAdd.map(item => [
      item.title,
      item.descText.split(',')[0],
      item.price
    ]);

    // Подготовка данных для ADDITIONAL
    const additionalHeaders = ['Title', 'Description', 'Price'];
    const additionalRows = additionalLots.map(item => [
      item.title,
      item.descText,
      item.price
    ]);

    // Сначала собираем все запросы в один массив
    const allRequests = [];
    
    // Очистка и форматирование всех листов
    [differenceSheet, needAddSheet, additionalSheet].forEach(sheet => {
      allRequests.push({
        updateCells: {
          range: {
            sheetId: sheet.properties.sheetId,
            startRowIndex: 0,
          },
          fields: '*'
        }
      });

      // Форматирование заголовков
      allRequests.push({
        repeatCell: {
          range: {
            sheetId: sheet.properties.sheetId,
            startRowIndex: 0,
            endRowIndex: 1,
          },
          cell: {
            userEnteredFormat: FORMAT_CONFIGS.HEADER,
          },
          fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment)',
        },
      });

      // Фиксируем первую строку
      allRequests.push({
        updateSheetProperties: {
          properties: {
            sheetId: sheet.properties.sheetId,
            gridProperties: {
              frozenRowCount: 1,
            },
          },
          fields: 'gridProperties.frozenRowCount',
        },
      });
    });

    // Записываем данные и форматирование для DIFFERENCE
    // Заголовки
    allRequests.push({
      updateCells: {
        range: {
          sheetId: differenceSheet.properties.sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
        },
        rows: [{
          values: headers.map(header => ({
            userEnteredValue: { stringValue: header }
          }))
        }],
        fields: 'userEnteredValue'
      }
    });

    // Данные и форматирование строк
    rows.forEach((row, index) => {
      const rowIndex = index + 1;
      const backgroundColor = FORMAT_CONFIGS.ROW_TYPES[row[0]];

      // Записываем значения строки
      allRequests.push({
        updateCells: {
          range: {
            sheetId: differenceSheet.properties.sheetId,
            startRowIndex: rowIndex,
            endRowIndex: rowIndex + 1,
          },
          rows: [{
            values: row.map((value, colIndex) => ({
              userEnteredValue: colIndex >= 3 && colIndex <= 5 ? 
                { numberValue: value || 0 } : 
                { stringValue: value.toString() }
            }))
          }],
          fields: 'userEnteredValue'
        }
      });

      if (backgroundColor) {
        // Форматирование всей строки
        allRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 0,
              endColumnIndex: 6
            },
            cell: {
              userEnteredFormat: {
                backgroundColor,
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'RIGHT',
                textFormat: { fontFamily: 'Roboto', fontSize: 10 },
                wrapStrategy: 'CLIP',
              }
            },
            fields: 'userEnteredFormat'
          }
        });

        // Выравнивание по левому краю для Type и Title
        allRequests.push({
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
                horizontalAlignment: 'LEFT',
              }
            },
            fields: 'userEnteredFormat.horizontalAlignment'
          }
        });
      }

      // Подсветка большой разницы в цене
      if (row[5] && parseFloat(row[5]) > 100) {
        allRequests.push({
          repeatCell: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 5,
              endColumnIndex: 6,
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
              }
            },
            fields: 'userEnteredFormat'
          }
        });
      }

      // Добавляем ссылки
      if (differences[index].offerLink2) {
        allRequests.push({
          updateCells: {
            range: {
              sheetId: differenceSheet.properties.sheetId,
              startRowIndex: rowIndex,
              endRowIndex: rowIndex + 1,
              startColumnIndex: 2,
              endColumnIndex: 3
            },
            rows: [{
              values: [{
                userEnteredValue: { stringValue: "Открыть" },
                textFormatRuns: [{
                  startIndex: 0,
                  format: {
                    link: { uri: differences[index].offerLink2 },
                    foregroundColor: { red: 0.06, green: 0.45, blue: 0.87 },
                    underline: true
                  }
                }]
              }]
            }],
            fields: 'userEnteredValue,textFormatRuns'
          }
        });
      }
    });

    // Форматирование цен
    allRequests.push({
      repeatCell: {
        range: {
          sheetId: differenceSheet.properties.sheetId,
          startRowIndex: 1,
          endRowIndex: rows.length + 1,
          startColumnIndex: 3,
          endColumnIndex: 6,
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
    });

    // Устанавливаем одинаковую ширину для всех столбцов
    [differenceSheet, needAddSheet, additionalSheet].forEach(sheet => {
      const columnCount = sheet === differenceSheet ? 6 : 3;
      allRequests.push({
        updateDimensionProperties: {
          range: {
            sheetId: sheet.properties.sheetId,
            dimension: 'COLUMNS',
            startIndex: 0,
            endIndex: columnCount
          },
          properties: {
            pixelSize: 150
          },
          fields: 'pixelSize'
        }
      });
    });

    // Записываем данные для NEED ADD
    if (needAddRows.length > 0) {
      allRequests.push(
        // Заголовки
        {
          updateCells: {
            range: {
              sheetId: needAddSheet.properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            rows: [{
              values: needAddHeaders.map(header => ({
                userEnteredValue: { stringValue: header }
              }))
            }],
            fields: 'userEnteredValue'
          }
        },
        // Данные и форматирование
        {
          updateCells: {
            range: {
              sheetId: needAddSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: needAddRows.length + 1,
            },
            rows: needAddRows.map(row => ({
              values: row.map((value, colIndex) => ({
                userEnteredValue: { stringValue: value.toString() }
              }))
            })),
            fields: 'userEnteredValue'
          }
        },
        // Форматирование всех ячеек
        {
          repeatCell: {
            range: {
              sheetId: needAddSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: needAddRows.length + 1,
              startColumnIndex: 0,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 1, green: 0.8, blue: 0.8 },
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'LEFT',
                textFormat: { fontFamily: 'Roboto', fontSize: 10 },
                wrapStrategy: 'CLIP',
              }
            },
            fields: 'userEnteredFormat'
          }
        },
        // Выравнивание цен по правому краю
        {
          repeatCell: {
            range: {
              sheetId: needAddSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: needAddRows.length + 1,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'RIGHT',
              }
            },
            fields: 'userEnteredFormat.horizontalAlignment'
          }
        }
      );
    }

    // Записываем данные для ADDITIONAL
    if (additionalRows.length > 0) {
      allRequests.push(
        // Заголовки
        {
          updateCells: {
            range: {
              sheetId: additionalSheet.properties.sheetId,
              startRowIndex: 0,
              endRowIndex: 1,
            },
            rows: [{
              values: additionalHeaders.map(header => ({
                userEnteredValue: { stringValue: header }
              }))
            }],
            fields: 'userEnteredValue'
          }
        },
        // Данные и форматирование
        {
          updateCells: {
            range: {
              sheetId: additionalSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: additionalRows.length + 1,
            },
            rows: additionalRows.map(row => ({
              values: row.map((value, colIndex) => ({
                userEnteredValue: { stringValue: value.toString() }
              }))
            })),
            fields: 'userEnteredValue'
          }
        },
        // Форматирование всех ячеек
        {
          repeatCell: {
            range: {
              sheetId: additionalSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: additionalRows.length + 1,
              startColumnIndex: 0,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.8, green: 0.6, blue: 1 },
                verticalAlignment: 'MIDDLE',
                horizontalAlignment: 'LEFT',
                textFormat: { fontFamily: 'Roboto', fontSize: 10 },
                wrapStrategy: 'CLIP',
              }
            },
            fields: 'userEnteredFormat'
          }
        },
        // Выравнивание цен по правому краю
        {
          repeatCell: {
            range: {
              sheetId: additionalSheet.properties.sheetId,
              startRowIndex: 1,
              endRowIndex: additionalRows.length + 1,
              startColumnIndex: 2,
              endColumnIndex: 3,
            },
            cell: {
              userEnteredFormat: {
                horizontalAlignment: 'RIGHT',
              }
            },
            fields: 'userEnteredFormat.horizontalAlignment'
          }
        }
      );
    }

    // Применяем все изменения одним запросом
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SPREADSHEET_ID,
      resource: { requests: allRequests }
    });

    console.log(chalk.green.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.green('✓ Данные успешно записаны'));

  } catch (error) {
    console.log(chalk.red.bold('📊 Google Sheets') + chalk.white(' → ') + chalk.red('✗ Ошибка: ') + error.message);
    process.exit(1);
  }
}

writeToGoogleSheets();