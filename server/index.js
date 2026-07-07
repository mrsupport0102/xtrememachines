/**
 * Xtreme Machines – lokal udviklingsserver
 */

const { createApp } = require('./createApp');

const PORT = process.env.PORT || 8765;
const app = createApp({ serveStatic: true });

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Xtreme Machines kører på port ${PORT}`);
  console.log(`Adminpanel: /admin`);
});
