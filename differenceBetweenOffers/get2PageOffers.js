import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
    const profileNamesPath = join(__dirname, 'profile_names.json');
    
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
      const categoryLink = $(element).closest('.offer').find('.offer-list-title a').attr('href') || '';
      const node_id = categoryLink.split('/').filter(Boolean).pop() || '';

      currentItems.push({
        profileName,
        title,
        descText,
        price,
        node_id
      });
    });

    const filePath = join(__dirname, fileName);
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
