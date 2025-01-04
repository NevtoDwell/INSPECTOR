export function log(message, type = 'i') {
    const colors = {
        r: '\x1b[31m', // red
        g: '\x1b[32m', // green
        y: '\x1b[33m', // yellow
        b: '\x1b[34m', // blue
        i: '\x1b[37m'  // white
    };
    
    console.log(colors[type], message, '\x1b[0m');
} 