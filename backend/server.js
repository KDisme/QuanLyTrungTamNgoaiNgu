require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./src/app');
const migrateHomework = require('./src/config/migrate');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await migrateHomework();
    console.log('✅ Database migration completed');
  } catch (err) {
    console.error('❌ Database migration failed:', err.message);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
    console.log(`📦 Environment: ${process.env.NODE_ENV}`);
  });
}

start();
