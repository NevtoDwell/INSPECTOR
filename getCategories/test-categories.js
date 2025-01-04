import { saveCategoriesData } from './categories.js';

saveCategoriesData()
    .then(() => {
        console.log('Categories have been successfully saved to categories.json');
    })
    .catch(error => {
        console.error('Error:', error);
    }); 