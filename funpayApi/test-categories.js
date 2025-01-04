import { saveCategoriesData } from './categories.js';

saveCategoriesData()
    .then(categories => {
        console.log('Полученные категории:', categories);
    })
    .catch(error => {
        console.error('Произошла ошибка:', error);
    }); 