const { spawn } = require('child_process');
const http = require('http');

const child = spawn('node', ['--experimental-modules', 'mcp/index.ts'], { env: { ...process.env, PORT: '3001' } });
child.stderr.on('data', (data) => console.log(data.toString()));

setTimeout(() => {
  const req = http.request('http://localhost:3001/memory', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer default-dev-token'
    }
  }, (res) => {
    let data = '';
    res.on('data', d => data += d);
    res.on('end', () => {
      console.log('Response:', res.statusCode, data);
      child.kill();
    });
  });
  req.write(JSON.stringify({ content: 'test memory' }));
  req.end();
}, 1500);
