require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const app = require('./src/app');
const migrateHomework = require('./src/config/migrate');
const aiGradingService = require('./src/services/aiGrading.service');

const PORT = process.env.PORT || 3001;

async function start() {
  try {
    await migrateHomework();
    console.log('✅ Database migration completed');
    const resumedAiJobs = await aiGradingService.resumeQueuedRuns();
    if (resumedAiJobs) console.log(`🤖 Resumed ${resumedAiJobs} queued AI grading job(s)`);
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
