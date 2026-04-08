const { createClient } = require('redis');
async function test() {
  const client = createClient();
  await client.connect();
  console.log('Connected');
  await client.quit();
}
test().catch(console.error);
