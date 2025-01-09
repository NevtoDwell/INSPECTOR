import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const urls = [
  { url: 'https://funpay.com/users/3194633/', file: 'user_1.json' },
  { url: 'https://funpay.com/users/292020/', file: 'user_2.json' }
];

async function fetchOffers(url, fileName) {
  try {
    // Параллельная загрузка русской и английской версий
    const enUrl = url.replace('https://funpay.com/', 'https://funpay.com/en/');
    const [ruResponse, enResponse] = await Promise.all([
      axios.get(url),
      axios.get(enUrl).catch(() => ({ data: null }))
    ]);

    const $ = cheerio.load(ruResponse.data);
    const $en = enResponse.data ? cheerio.load(enResponse.data) : $;

    const profileName = $('div.profile h1 span.mr4').text().trim() || 'Not found';
    
    // Обновляем profile_names
    let profileNames = {};
    const profileNamesPath = join(__dirname, 'profile_names.json');
    
    if (fs.existsSync(profileNamesPath)) {
      profileNames = JSON.parse(fs.readFileSync(profileNamesPath, 'utf-8'));
    }

    profileNames[fileName === 'user_1.json' ? 'user_1' : 'user_2'] = profileName;

    fs.writeFileSync(
      profileNamesPath,
      JSON.stringify(profileNames, null, 2),
      'utf-8'
    );

    // Оптимизированный сбор данных
    const items = $('.tc-item').map((index, element) => {
      const $item = $(element);
      const $offer = $item.closest('.offer');
      const offerLink = $item.attr('href') || '';
      const offerId = offerLink.split('id=')[1];
      
      // Получаем английское описание
      const $enItem = $en(`.tc-item[href*="id=${offerId}"]`);
      
      return {
        profileName,
        title: $offer.find('.offer-list-title a').text().trim() || 'Неизвестный заголовок',
        descText: $item.find('.tc-desc-text').text().trim().split(',')[0],
        descTextEn: $enItem.find('.tc-desc-text').text().trim().split(',')[0],
        price: $item.find('.tc-price div').text().trim(),
        node_id: ($offer.find('.offer-list-title a').attr('href') || '').split('/').filter(Boolean).pop() || '',
        offerLink,
        options: $item.find('.tc-desc-text').text().trim().split(',').slice(1).map(opt => opt.trim()).filter(opt => opt).join(', ') || 'С заходом на аккаунт'
      };
    }).get();

    const filePath = join(__dirname, fileName);
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf-8');
    console.log(chalk.blue.bold('🌐 FunPay') + chalk.white(' → ') + chalk.green('✓ ') + chalk.green(`Данные ${fileName} сохранены`));
  } catch (error) {
    console.log(chalk.blue.bold('🌐 FunPay') + chalk.white(' → ') + chalk.red('✗ Ошибка: ') + error.message);
  }
}

async function main() {
  await Promise.all(urls.map(async ({ url, file }) => fetchOffers(url, file)));
}

main();
