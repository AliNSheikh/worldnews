import { createApp } from './app';

const PORT = Number(process.env.PORT || 3000);
const app = await createApp({ serveFrontend: true });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`World News server listening on http://0.0.0.0:${PORT}`);
});
