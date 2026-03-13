const http = require('http');
const fs   = require('fs');
const path = require('path');

const PORT = 3000;
const HTML = path.join(__dirname, 'index.html');

http.createServer((req, res) => {
  fs.readFile(HTML, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(data);
  });
}).listen(PORT, () => {
  console.log('Server running at http://localhost:' + PORT);
});
