import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const categories = JSON.parse(
    readFileSync(join(__dirname, '../getCategories/categories.json'), 'utf8')
);

export function getNodeIdByName(categoryName) {
    const category = categories.find(cat => cat.name === categoryName);
    if (!category) {
        throw new Error(`Category "${categoryName}" not found`);
    }
    return category.node_id;
} 