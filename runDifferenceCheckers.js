import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import chalk from 'chalk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const differenceFolderPath = join(__dirname, 'differenceBetweenOffers');

async function runDifferenceCheckers() {
    try {
        const files = readdirSync(differenceFolderPath)
            .filter(file => file.endsWith('.js'))
            .map(file => join(differenceFolderPath, file));

        console.log(chalk.blue(`Найдено ${files.length} скриптов для проверки различий`));

        for (const file of files) {
            console.log(chalk.yellow(`Запуск: ${file}`));
            
            const childProcess = spawn('node', [file], { 
                stdio: 'inherit',
                shell: true 
            });

            await new Promise((resolve, reject) => {
                childProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(chalk.green(`✓ Скрипт ${file} завершен успешно`));
                        resolve();
                    } else {
                        console.error(chalk.red(`✗ Скрипт ${file} завершен с ошибкой (код ${code})`));
                        reject(new Error(`Скрипт ${file} завершен с кодом ${code}`));
                    }
                });

                childProcess.on('error', (err) => {
                    console.error(chalk.red(`Ошибка при запуске ${file}:`, err));
                    reject(err);
                });
            });

            // Небольшая задержка между запусками
            await new Promise(resolve => setTimeout(resolve, 2000));
        }

        console.log(chalk.green('Все скрипты проверки различий выполнены'));
    } catch (error) {
        console.error(chalk.red('Ошибка при запуске скриптов:', error));
    }
}

runDifferenceCheckers();
