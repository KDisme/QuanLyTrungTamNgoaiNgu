require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./src/app');
const migrateHomework = require('./src/config/migrate');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await migrateHomework();
  } catch (err) {
    console.error('⚠️  Homework schema migration skipped:', err.message);
    // Tiếp tục start server — base schema có thể chưa được import
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  });
}

start();
