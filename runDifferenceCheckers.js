import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const differenceFolderPath = join(__dirname, 'differenceBetweenOffers');
const INTERVAL = 30; // секунд между проверками

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getTimestamp() {
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
    const time = now.toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    return chalk.hex('#6CB6FF')(`[${date} ${time}]`);
}

function log(message, newLine = false) {
    console.log(`${getTimestamp()} ${message}${newLine ? '\n' : ''}`);
}

async function runDifferenceCheckers() {
    try {
        const scriptsToRun = [
            { name: 'Загрузка данных FunPay', file: join(differenceFolderPath, 'get2PageOffers.js') },
            { name: 'Сравнение офферов', file: join(differenceFolderPath, 'compareOffers.js') },
            { name: 'Запись в Google Sheets', file: join(differenceFolderPath, 'writeToGoogleSheets.js') }
        ];

        log('🔄 ' + chalk.cyan.bold('Запуск проверки различий...'));
        
        let offersCount = 0;

        for (let i = 0; i < scriptsToRun.length; i++) {
            const { name, file } = scriptsToRun[i];
            const step = i + 1;
            
            let scriptOutput = '';
            log(chalk.yellow(`[${step}/${scriptsToRun.length}] `) + chalk.white(name));
            process.stdout.write(`${getTimestamp()} ` + chalk.gray('⏳ В процессе...'));

            const childProcess = spawn('node', [file], { 
                stdio: ['inherit', 'pipe', 'pipe'],
                shell: true,
                maxBuffer: 1024 * 1024 * 10
            });

            childProcess.stdout.on('data', (data) => {
                scriptOutput += data.toString();
            });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    childProcess.kill();
                    reject(new Error(`Таймаут операции: ${name}`));
                }, 300000);

                childProcess.on('close', (code) => {
                    clearTimeout(timeout);
                    process.stdout.clearLine(0);
                    process.stdout.cursorTo(0);
                    
                    if (code === 0) {
                        if (name === 'Сравнение офферов') {
                            const match = scriptOutput.match(/OFFERS_TO_ADD:(\d+)/);
                            if (match) {
                                offersCount = parseInt(match[1]);
                                log(chalk.green('✓ Завершено') + chalk.white(' → ') + 
                                    chalk.yellow(`Найдено офферов для добавления: ${offersCount}`));
                            } else {
                                log(chalk.green('✓ Завершено'));
                            }
                        } else {
                            log(chalk.green('✓ Завершено'));
                        }
                        resolve();
                    } else {
                        reject(new Error(`Ошибка при выполнении: ${name}`));
                    }
                });

                childProcess.on('error', (err) => {
                    clearTimeout(timeout);
                    reject(err);
                });
            });

            await new Promise(resolve => setTimeout(resolve, 500));
        }

        log('✨ ' + chalk.green.bold('Все операции успешно завершены!'), true);

    } catch (error) {
        log(chalk.red.bold('⚠️ Ошибка') + chalk.white(' → ') + chalk.red(error.message));
        throw error;
    }
}

async function startMonitoring() {
    log('🚀 ' + chalk.cyan.bold('Запуск мониторинга FunPay'));
    log(chalk.gray(`Интервал проверки: ${INTERVAL} секунд`), true);

    while (true) {
        try {
            await runDifferenceCheckers();
            
            for (let i = INTERVAL; i > 0; i--) {
                process.stdout.clearLine(0);
                process.stdout.cursorTo(0);
                process.stdout.write(
                    `${getTimestamp()} ` +
                    chalk.yellow('⏰ Следующая проверка через: ') + 
                    chalk.white(`${i} сек`)
                );
                await sleep(1000);
            }
            process.stdout.clearLine(0);
            process.stdout.cursorTo(0);
            
        } catch (error) {
            await sleep(5000);
        }
    }
}

startMonitoring();
