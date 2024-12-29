const fs = require('fs');
const path = require('path');

function getDirectoryStructure(dirPath, prefix = '') {
    let result = '';
    const items = fs.readdirSync(dirPath, { withFileTypes: true });

    items.forEach((item, index) => {
        const isLast = index === items.length - 1;
        const itemPrefix = prefix + (isLast ? '└── ' : '├── ');

        result += itemPrefix + item.name + '\n';

        if (item.isDirectory()) {
            const childPrefix = prefix + (isLast ? '    ' : '│   ');
            result += getDirectoryStructure(path.join(dirPath, item.name), childPrefix);
        }
    });

    return result;
}

// Путь к директории, которую нужно обойти
const projectPath = './FUNPAY_INSPECTOR'; // Замените на ваш путь
if (fs.existsSync(projectPath)) {
    const structure = getDirectoryStructure(projectPath);
    console.log('Directory structure:\n' + structure);
} else {
    console.log('Directory does not exist.');
}
