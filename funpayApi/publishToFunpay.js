const { google } = require('googleapis');
const FunPayApi = require('./funpayApi');
const path = require('path');

async function publishLotsFromSheets() {
  try {
    const auth = new google.auth.GoogleAuth({
      keyFile: path.join(__dirname, '..', '..', 'api keys', 'credentials.json'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth: await auth.getClient() });
    const spreadsheetId = '1vMm_FHnUp1xH-07OoOr2BQIRKkOoVG0r1yKff82xVUw';

    // Получаем данные из таблицы
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'DIFFERENCE!A2:J', // Включая новые столбцы
    });

    const rows = response.data.values;
    const funpayApi = new FunPayApi();

    // Публикуем каждый лот
    for (const row of rows) {
      // Проверяем, что лот еще не опубликован
      if (row[9] !== 'Published') { // Индекс 9 - столбец Publish Status
        const lotData = {
          node_id: row[7],     // FunPay Category ID
          offer_id: row[8],    // FunPay Offer ID
          title: row[2],       // Description from user_1
          price: row[4].replace(/[^\d.]/g, ''), // Price from user_1
          method: 'Пополнение по ID',
          type: '%Акции-Promotions',
          description: ''  // Добавим пустое описание
        };

        console.log('Trying to publish lot:', lotData); // Добавим лог

        try {
          await funpayApi.createLot(lotData);
          
          // Обновляем статус публикации в таблице
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `DIFFERENCE!J${rows.indexOf(row) + 2}`, // +2 потому что начинаем со второй строки
            valueInputOption: 'RAW',
            resource: {
              values: [['Published']]
            }
          });

          console.log(`Lot published successfully: ${lotData.title}`);
        } catch (error) {
          console.error(`Failed to publish lot: ${lotData.title}`, error.message);
          
          // Обновляем статус с ошибкой
          await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `DIFFERENCE!J${rows.indexOf(row) + 2}`,
            valueInputOption: 'RAW',
            resource: {
              values: [['Failed']]
            }
          });
        }
      }
    }

  } catch (error) {
    console.error('Error publishing lots:', error.message);
  }
}

publishLotsFromSheets(); 