require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const http = require('http');
const { bootApp } = require('./app');

const port = Number(process.env.PORT || 5080);

bootApp()
  .then(async (app) => {
    // Know which properties can take payments before the first guest request.
    const gate = require('./services/paymobGate');
    await gate.refresh();
    gate.start();
    const server = http.createServer(app);
    server.listen(port, () => {
      console.log(`[prime] API listening on :${port}`);
      // Pull blocked nights into memory so guest calendars work before the first webhook.
      setImmediate(() => {
        try {
          const sync = require('./services/kwentraSync');
          // One-time unit/property content from the company's description sheets (skipped once applied).
          require('./services/contentPatch')
            .applyContentPatch()
            .catch((err) => console.warn('[content] patch failed:', err.message));
          require('./services/contentPatch')
            .applyContactNumbers()
            .catch((err) => console.warn('[content] contact numbers failed:', err.message));
          sync.startAutoSync();
          sync.warmAvailability().catch((err) => console.warn('[kwentra] boot availability failed:', err.message));
          require('./services/emailService').warm();
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
