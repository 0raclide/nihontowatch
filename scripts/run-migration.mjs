#!/usr/bin/env node
/**
 * Script to run SQL migrations against production Supabase
 * Executes SQL statements via the Supabase REST API
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUPABASE_URL = 'https://itbhfhyptogxcjbjfzwx.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml0YmhmaHlwdG9neGNqYmpmend4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg5MDgzNCwiZXhwIjoyMDgxNDY2ODM0fQ.sBLqYOuuK5m1dUK5GBA2lbRmCLZ037dQV8i9OwnyMWQ';

// Supabase project ref extracted from URL
const PROJECT_REF = 'itbhfhyptogxcjbjfzwx';

async function executeSql(sql) {
  // Use the Supabase SQL execution endpoint
  const response = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_SERVICE_KEY,
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`SQL execution failed: ${response.status} - ${text}`);
  }

  return response.json();
}

async function runMigration() {
  console.log('🚀 Running FTS migration against production Supabase...\n');
  console.log(`📍 Target: ${SUPABASE_URL}\n`);

  // Read migration file
  const migrationPath = join(__dirname, '../supabase/migrations/007_add_fulltext_search.sql');
  const fullSql = readFileSync(migrationPath, 'utf-8');

  // Parse into logical statements
  const statements = parseSqlStatements(fullSql);
  console.log(`📝 Parsed ${statements.length} SQL statements\n`);

  // Execute each statement
  for (let i = 0; i < statements.length; i++) {
    const { sql, description } = statements[i];
    console.log(`[${i + 1}/${statements.length}] ${description}`);

    try {
      // For this project, we'll log the SQL and you can run it in Supabase Dashboard
      console.log(`   SQL Preview: ${sql.substring(0, 80).replace(/\n/g, ' ')}...`);
      console.log(`   ℹ️  Execute in Supabase Dashboard SQL Editor`);
    } catch (err) {
      console.log(`   ❌ Error: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 FULL MIGRATION SQL - Copy and paste into Supabase SQL Editor:');
  console.log('='.repeat(60) + '\n');
  console.log(fullSql);
  console.log('\n' + '='.repeat(60));
  console.log('🔗 Supabase Dashboard: https://supabase.com/dashboard/project/' + PROJECT_REF + '/sql');
  console.log('='.repeat(60));
}

function parseSqlStatements(sql) {
  const statements = [];
  const lines = sql.split('\n');
  let current = { sql: '', description: '' };
  let inDollarQuote = false;
  let lastComment = '';

  for (const line of lines) {
    // Track comments for descriptions
    if (line.trim().startsWith('--') && !current.sql.trim()) {
      if (line.includes('STEP') || line.includes('============')) {
        lastComment = line.replace(/^--\s*/, '').replace(/=+/g, '').trim();
      }
      continue;
    }

    current.sql += line + '\n';

    // Track $$ quotes for function bodies
    const dollarMatches = line.match(/\$\$/g);
    if (dollarMatches) {
      for (const _ of dollarMatches) {
        inDollarQuote = !inDollarQuote;
      }
    }

    // End of statement
    if (!inDollarQuote && line.trim().endsWith(';')) {
      if (current.sql.trim()) {
        current.description = lastComment || getStatementType(current.sql);
        statements.push({ ...current });
      }
      current = { sql: '', description: '' };
    }
  }

  return statements.filter(s => s.sql.trim() && !s.sql.trim().startsWith('--'));
}

function getStatementType(sql) {
  const normalized = sql.trim().toUpperCase();
  if (normalized.startsWith('ALTER TABLE')) return 'ALTER TABLE';
  if (normalized.startsWith('CREATE OR REPLACE FUNCTION')) return 'CREATE FUNCTION';
  if (normalized.startsWith('CREATE FUNCTION')) return 'CREATE FUNCTION';
  if (normalized.startsWith('CREATE INDEX')) return 'CREATE INDEX';
  if (normalized.startsWith('CREATE TRIGGER')) return 'CREATE TRIGGER';
  if (normalized.startsWith('DROP TRIGGER')) return 'DROP TRIGGER';
  if (normalized.startsWith('UPDATE')) return 'UPDATE (backfill)';
  if (normalized.startsWith('GRANT')) return 'GRANT';
  if (normalized.startsWith('COMMENT')) return 'COMMENT';
  return 'SQL Statement';
}

runMigration().catch(console.error);
