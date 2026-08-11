import 'dotenv/config';
import { createTigerServer } from './create-tiger-server';

async function bootstrap() {
  await createTigerServer();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('[web-tiger] failed to start', err);
  process.exit(1);
});
