const fs = require('fs');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');

const urls = [
  { url: 'https://funpay.com/users/3194633/', file: 'user_1.json' },
  { url: 'https://funpay.com/users/292020/', file: 'user_2.json' }
];

async function fetchOffers(url, fileName) {
  try {
    const { data } = await axios.get(url);
    const $ = cheerio.load(data);

    const profileName = $('div.profile h1 span.mr4').text().trim() || 'Not found';
    
    let profileNames = {};
    const profileNamesPath = path.join(__dirname, 'profile_names.json');
    
    if (fs.existsSync(profileNamesPath)) {
      profileNames = JSON.parse(fs.readFileSync(profileNamesPath, 'utf-8'));
    }

    if (fileName === 'user_1.json') {
      profileNames.user_1 = profileName;
    } else if (fileName === 'user_2.json') {
      profileNames.user_2 = profileName;
    }

    fs.writeFileSync(
      profileNamesPath,
      JSON.stringify(profileNames, null, 2),
      'utf-8'
    );

    const currentItems = [];
    $('.tc-item').each((index, element) => {
      const fullDescText = $(element).find('.tc-desc-text').text().trim();
      const descText = fullDescText.split(',')[0];
      const price = $(element).find('.tc-price div').text().trim();
      const title = $(element).closest('.offer').find('.offer-list-title a').text().trim() || 'Неизвестный заголовок';

      currentItems.push({
        profileName,
        title,
        descText,
        price,
      });
    });

    const filePath = path.join(__dirname, fileName);
    fs.writeFileSync(filePath, JSON.stringify(currentItems, null, 2), 'utf-8');
    console.log(`Данные успешно сохранены в файл ${fileName}`);
  } catch (error) {
    console.error(`Error processing URL (${url}):`, error.message);
  }
}

async function main() {
  for (const { url, file } of urls) {
    await fetchOffers(url, file);
  }
}

main();
