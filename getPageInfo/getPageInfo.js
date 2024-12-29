const fs = require('fs');
const axios = require('axios');
const { parse } = require('node-html-parser');
const chalk = require("chalk");

const url = process.argv[2];

if (!url) {
  console.error(chalk.red('URL не указан. Пожалуйста, передайте URL в качестве аргумента.'));
  process.exit(1);
}

async function fetchData() {
  try {
    const { data } = await axios.get(url);
    const root = parse(data);

    const profileName = root.querySelector('div.profile h1 span.mr4')?.text?.trim() || 'Не найдено';

    const offers = root.querySelectorAll('div.offer').map((element) => {

      const categoryOffer = element.querySelector('.offer-list-title a')?.text?.trim();
      const linkOffer = element.querySelector('.offer-list-title a')?.getAttribute('href');
      
      const items = element.querySelectorAll('a.tc-item').map((item) => {
        const titleOffer = item.querySelector('.tc-desc-text')?.text?.trim();
        const priceOffer = item.querySelector('.tc-price div')?.text?.trim();
        return { title: titleOffer, price: priceOffer };
      });
    
      return { category: categoryOffer, link: linkOffer, items };
    }).filter(Boolean);

    const totalOffers = root.querySelectorAll('a.tc-item').length;

    const dataToSave = { profileName, offers, totalOffers };
    fs.writeFileSync('getPageInfo/offers.json', JSON.stringify(dataToSave, null, 2));

    console.log(chalk.green('Данные успешно сохранены в offers.json'));
  } catch (error) {
    console.error(chalk.red('Ошибка при извлечении данных:', error));
  }
}

fetchData();
