const { google } = require('googleapis');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const credentialsPath = path.join(__dirname, '..', '..', 'api keys', 'credentials.json');
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
const range = 'OFFER INSPECTOR!A1';

async function writeToSheet() {
  try {
    const offersData = JSON.parse(fs.readFileSync('getPageInfo/offers.json', 'utf8'));
    const profileName = offersData.profileName || 'Unknown Profile';

    const values = [
      [`PROFILE NAME: ${profileName}`], 
      [`TOTAL OFFERS: ${offersData.totalOffers}`],
      [], 
      ['CAREGORY', 'LINK', 'PRICE', 'TITLE'], 
    ];

    offersData.offers.forEach((offer) => {
      if (offer.items && offer.items.length > 0) {
        offer.items.forEach((item) => {
          values.push([
            offer.category, 
            offer.link, 
            item.title,
            item.price,
          ]);
        });
      } else {
        values.push([offer.category, offer.link, 'No offers', 'N/A']);
      }
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: 'RAW',
      requestBody: {
        values,
      },
    });

    console.log(chalk.green('Данные успешно записаны в таблицу. ' + range));

    await applyStyles();
  } catch (error) {
    console.error(chalk.red('Ошибка записи в таблицу:', error));
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
    console.error(chalk.red('Ошибка при применении стилей:', error));
  }
}

writeToSheet();
