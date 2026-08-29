require('dotenv').config();
const fs   = require('fs');
const path = require('path');
const { db } = require('../src/config/db');

function runMigrations() {
  console.log('Running SmartYatra SQLite migrations...');
  try {
    // Run base schema
    const sql = fs.readFileSync(path.join(__dirname, '001_schema_sqlite.sql'), 'utf8');
    db.exec(sql);
    console.log('✅ Base schema migration completed.');
    
    // Run resilience schema
    const resilienceSql = fs.readFileSync(path.join(__dirname, '002_resilience_schema.sql'), 'utf8');
    db.exec(resilienceSql);
    console.log('✅ Resilience schema migration completed.');
    
    console.log('   Database file: backend/data/smartyatra.db');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
    process.exit(1);
  }
}

runMigrations();
