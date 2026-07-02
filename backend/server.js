require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./src/app');
const migrateHomework = require('./src/config/migrate');

const PORT = process.env.PORT || 3001;

migrateHomework()
  .catch((err) => {
    console.error('❌ Failed to prepare homework schema:', err);
    process.exit(1);
  })
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Server running on http://localhost:${PORT}`);
      console.log(`📦 Environment: ${process.env.NODE_ENV}`);
    });
  });
