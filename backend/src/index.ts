import { createApp } from './app';
import { connectDB } from './config/db';
import { env } from './config/env';
import { expireOverdueRequests } from './services/paymentRequest.service';

async function main() {
  await connectDB();
  const app = createApp();

  app.listen(env.PORT, '0.0.0.0', () => {
    // eslint-disable-next-line no-console
    console.log(`[amwali] API listening on http://0.0.0.0:${env.PORT}`);
  });

  // Expired-link protection runs continuously, not only on request.
  const tick = async () => {
    try {
      const n = await expireOverdueRequests();
      if (n > 0) console.log(`[amwali] expired ${n} payment request(s)`);
    } catch (err) {
      console.error('[amwali] expiry job failed', err);
    }
  };
  await tick();
  setInterval(tick, 5 * 60 * 1000);
}

main().catch((err) => {
  console.error('[amwali] fatal startup error', err);
  process.exit(1);
});
