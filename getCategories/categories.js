import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getAuthCookies } from '../funpayApi/auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function getInitialCategories() {
    try {
        console.log('🔍 Fetching categories...');
        const response = await axios.get('https://funpay.com/users/292020/');
        const $ = cheerio.load(response.data);
        
        const categories = [];
        
        // Ищем категории в offer-list-title
        $('.offer-list-title h3 a').each((_, element) => {
            const name = $(element).text().trim();
            const href = $(element).attr('href');
            const node_id = href.match(/\/lots\/(\d+)/)?.[1];
            
            if (node_id && name) {
                categories.push({ name, node_id });
            }
        });
        
        if (categories.length === 0) {
            console.warn('⚠️ No categories found!');
        } else {
            console.log(`📋 Found ${categories.length} categories`);
        }
        
        return categories;
    } catch (error) {
        console.error('❌ Failed to fetch categories:', error.message);
        throw error;
    }
}

// Добавляем функцию задержки
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function saveCategoriesData() {
    try {
        const jsonPath = path.join(__dirname, 'categories.json');
        const initialCategories = await getInitialCategories();
        
        const goldenKey = 'r126an7ycpe0k8p5ltoqkncp2a6ddkwt';
        const authData = await getAuthCookies(goldenKey);
        const axiosConfig = {
            headers: {
                'Cookie': authData.cookies,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        };
        
        const updatedCategories = [];

        for (const category of initialCategories) {
            process.stdout.write(`⏳ Processing: ${category.name}...`);
            await delay(2000);

            let retryCount = 0;
            const maxRetries = 3;

            while (retryCount < maxRetries) {
                try {
                    const url = `https://funpay.com/lots/${category.node_id}/`;
                    const response = await axios.get(url, axiosConfig);
                    const $ = cheerio.load(response.data);

                    // Получаем options из select с name="f-method"
                    const methodOptions = [];
                    $('select[name="f-method"] option').each((_, option) => {
                        const text = $(option).text().trim();
                        const value = $(option).attr('value');
                        if (value && value !== '') {  // Пропускаем пустые значения и placeholder
                            methodOptions.push(text);
                        }
                    });

                    // Получаем options из кнопок в lot-field-radio-box
                    const typeOptions = [];
                    $('.lot-field-radio-box button[type="button"]').each((_, button) => {
                        const text = $(button).text().trim();
                        if (text !== 'Все') {  // Пропускаем кнопку "Все"
                            typeOptions.push(text);
                        }
                    });

                    if (methodOptions.length || typeOptions.length) {
                        process.stdout.write(' ✅\n');
                        
                        if (methodOptions.length) {
                            console.log(`  └─ Methods: ${methodOptions.join(', ')}`);
                        }
                        if (typeOptions.length) {
                            console.log(`  └─ Types: ${typeOptions.join(', ')}`);
                        }
                    } else {
                        process.stdout.write(' ⚠️\n');
                    }

                    updatedCategories.push({
                        name: category.name,
                        node_id: category.node_id,
                        fields: {
                            ...(methodOptions.length > 0 && {
                                method: {
                                    name: "Способ пополнения",
                                    options: methodOptions
                                }
                            }),
                            ...(typeOptions.length > 0 && {
                                type: {
                                    name: "Тип доната",
                                    options: typeOptions
                                }
                            })
                        }
                    });

                    break;
                } catch (error) {
                    retryCount++;
                    if (error.response?.status === 429) {
                        process.stdout.write(` 🕒 Retry ${retryCount}/${maxRetries} (waiting ${5 * retryCount}s)...\n`);
                        await delay(5000 * retryCount);
                        continue;
                    }
                    process.stdout.write(' ❌\n');
                    console.error(`  └─ Error: ${error.message}`);
                    break;
                }
            }
        }

        await fs.mkdir(path.dirname(jsonPath), { recursive: true });
        const jsonContent = JSON.stringify(updatedCategories, null, 2);
        await fs.writeFile(jsonPath, jsonContent, 'utf-8');
        console.log(`\n✅ Saved ${updatedCategories.length} categories to ${jsonPath}`);
        return updatedCategories;

    } catch (error) {
        console.error('❌ Fatal error:', error.message);
        throw error;
    }
}

async function main() {
    try {
        await saveCategoriesData();
        console.log('Categories processing completed successfully');
    } catch (error) {
        console.error('Failed to process categories:', error);
        process.exit(1);
    }
}

// Run the script if it's called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    main();
}
