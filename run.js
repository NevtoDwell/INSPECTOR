const { exec } = require('child_process');
const path = require('path');

// Пути к файлам
const get2PageOffersPath = path.join(__dirname, 'differenceBetweenOffers', 'get2PageOffers.js');
const compareOffersPath = path.join(__dirname, 'differenceBetweenOffers', 'compareOffers.js');
const writeToGoogleSheetsPath = path.join(__dirname, 'differenceBetweenOffers', 'writeToGoogleSheets.js');

// Функция для запуска скрипта с промисами
function runScript(scriptPath) {
  return new Promise((resolve, reject) => {
    console.log(`Запускаем ${path.basename(scriptPath)}...`);
    
    exec(`node "${scriptPath}"`, (error, stdout, stderr) => {
      if (error) {
        console.error(`Ошибка при запуске ${path.basename(scriptPath)}: ${error.message}`);
        reject(error);
        return;
      }
      
      if (stderr) {
        console.error(`${path.basename(scriptPath)} вывел ошибку: ${stderr}`);
      }
      
      console.log(`Результат ${path.basename(scriptPath)}:\n${stdout}`);
      resolve(stdout);
    });
  });
}

// Асинхронная функция для последовательного запуска скриптов
async function runAllScripts() {
  try {
    // 1. Сбор офферов
    await runScript(get2PageOffersPath);
    console.log('Сбор офферов завершен успешно');

    // 2. Сравнение офферов
    await runScript(compareOffersPath);
    console.log('Сравнение офферов завершено успешно');

    // 3. Запись в Google Sheets
    await runScript(writeToGoogleSheetsPath);
    console.log('Запись в Google Sheets завершена успешно');

    console.log('Все операции выполнены успешно!');
  } catch (error) {
    console.error('Произошла ошибка при выполнении скриптов:', error);
    process.exit(1);
  }
}

// Запускаем все скрипты
runAllScripts();
