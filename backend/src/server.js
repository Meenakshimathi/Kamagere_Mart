const config = require('./config');
require('./db');
require('./seed')();
const app = require('./app')();

app.listen(config.port, () => {
  console.log(`Kamagere Mart running at http://localhost:${config.port}  (API: /api, health: /api/health)`);
});
