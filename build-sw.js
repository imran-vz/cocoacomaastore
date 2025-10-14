const fs = require('fs');

const file = 'public/sw.js';
let content = fs.readFileSync(file, 'utf8');
content = content.replace(/export \\{\\};?\\s*$/m, '');
fs.writeFileSync(file, content);
