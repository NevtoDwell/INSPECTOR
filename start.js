const { exec } = require('child_process');
const path = require('path');
const chalk = require("chalk");

const userId = '292020'; 
const baseUrl = 'https://funpay.com/users/'; 
const url = `${baseUrl}${userId}/`;

// const getPageInfoPath = path.join(__dirname, 'getPageInfo/getPageInfo.js');
// const googleSheetsPath = path.join(__dirname, 'getPageInfo/googleSheets.js');

const getNewOffersPath = path.join(__dirname, 'getNewOffers/getNewOffers.js');
const googleSheetsNewOffersPath = path.join(__dirname, 'getNewOffers/googleSheetsNewOffers.js');

// Функция для получения текущего времени
function getCurrentTime() {
  const now = new Date();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
  const time = now.toTimeString().split(' ')[0]; // HH:MM:SS
  return `[${date}] [${time}]`;
}

function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    const command = `node "${scriptPath}" ${args.map(arg => `"${arg}"`).join(' ')}`;
    const process = exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`${getCurrentTime()} Ошибка при выполнении ${scriptPath}:`, error);
        reject(error);
        return;
      }
      if (stderr) console.error(`${getCurrentTime()} Предупреждения ${scriptPath}:\n`, stderr);
      resolve();
    });
  });
}

async function start() {
  try {
    // console.log(`${getCurrentTime()} ${chalk.yellow('Запуск getPageInfo.js...')}`);
    // await runScript(getPageInfoPath, [url]);

    // console.log(`${getCurrentTime()} ${chalk.yellow('Запуск googleSheets.js...')}`);
    // await runScript(googleSheetsPath, [url]);


    console.log(`${getCurrentTime()} ${chalk.yellow('Запуск getNewOffers.js...')}`);
    await runScript(getNewOffersPath, [url]);

    console.log(`${getCurrentTime()} ${chalk.yellow('Запуск googleSheetsNewOffers.js...')}`);
    await runScript(googleSheetsNewOffersPath, [url]);


    console.log(`${getCurrentTime()} ${chalk.green('Все скрипты выполнены успешно.')}`);
  } catch (error) {
    console.error(`${getCurrentTime()} Произошла ошибка:`, error);
  }
}

// start();

function scheduleTask(interval) {
  console.log(`${getCurrentTime()} ${chalk.blue(`Обработчик задач будет запускаться каждые ${interval / 1000} сек.`)}`);
  start(); // Запуск задачи сразу
  setInterval(() => {
    console.log(`${getCurrentTime()} ${chalk.blue('Повторный запуск задач...')}`);
    start();
  }, interval);
}

// Установка таймера на 15 сек
scheduleTask(10 * 1000);
