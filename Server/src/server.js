require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const { bootApp } = require('./app');

const port = Number(process.env.PORT || 5080);

bootApp()
  .then((app) => {
    const server = http.createServer(app);
    server.listen(port, () => {
      console.log(`[prime] API listening on :${port}`);
      // Pull blocked nights into memory so guest calendars work before the first webhook.
      setImmediate(() => {
        try {
          require('./services/kwentraSync')
            .warmAvailability()
            .catch((err) => console.warn('[kwentra] boot availability failed:', err.message));
        } catch (err) {
          console.warn('[kwentra] boot availability skipped:', err.message);
        }
      });
    });
  })
  .catch((err) => {
    console.error('[prime] Failed to start:', err);
    process.exit(1);
  });
