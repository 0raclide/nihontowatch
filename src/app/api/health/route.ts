import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getEmailBudget, type EmailBudget } from '@/lib/email/budget';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: ComponentHealth;
    environment: ComponentHealth;
    email_budget: ComponentHealth & { detail?: EmailBudget };
  };
}

interface ComponentHealth {
  status: 'pass' | 'warn' | 'fail';
  latency_ms?: number;
  message?: string;
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck['checks'] = {
    database: { status: 'fail' },
    environment: { status: 'fail' },
    email_budget: { status: 'fail' },
  };

  // Check environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  ];
  const missingEnvVars = requiredEnvVars.filter((v) => !process.env[v]);

  if (missingEnvVars.length === 0) {
    checks.environment = { status: 'pass' };
  } else {
    checks.environment = {
      status: 'fail',
      message: `Missing: ${missingEnvVars.join(', ')}`,
    };
  }

  // Check database connectivity
  try {
    const dbStart = Date.now();
    const supabase = await createClient();

    // Simple query to verify connection
    const { error } = await supabase
      .from('dealers')
      .select('id')
      .limit(1)
      .single();

    const dbLatency = Date.now() - dbStart;

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows found, which is fine for health check
      checks.database = {
        status: 'fail',
        latency_ms: dbLatency,
        message: error.message,
      };
    } else {
      checks.database = {
        status: 'pass',
        latency_ms: dbLatency,
      };
    }
  } catch (err) {
    checks.database = {
      status: 'fail',
      message: err instanceof Error ? err.message : 'Database connection failed',
    };
  }

  // Check email budget (SendGrid daily limit)
  try {
    const budget = await getEmailBudget();
    if (budget.status === 'exhausted') {
      checks.email_budget = {
        status: 'fail',
        message: `Daily limit reached: ${budget.sent}/${budget.limit} emails sent`,
        detail: budget,
      };
    } else if (budget.status === 'warning') {
      checks.email_budget = {
        status: 'warn',
        message: `${budget.percentUsed.toFixed(0)}% used: ${budget.sent}/${budget.limit} emails sent`,
        detail: budget,
      };
    } else {
      checks.email_budget = {
        status: 'pass',
        message: `${budget.sent}/${budget.limit} emails sent today`,
        detail: budget,
      };
    }
  } catch (err) {
    checks.email_budget = {
      status: 'pass',
      message: 'Could not check email budget',
    };
  }

  // Determine overall status
  const statuses = Object.values(checks).map((c) => c.status);
  const hasFail = statuses.includes('fail');
  const hasWarn = statuses.includes('warn');
  const allFailing = statuses.every((s) => s === 'fail');

  let overallStatus: HealthCheck['status'];
  if (allFailing) {
    overallStatus = 'unhealthy';
  } else if (hasFail || hasWarn) {
    overallStatus = 'degraded';
  } else {
    overallStatus = 'healthy';
  }

  const response: HealthCheck = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'dev',
    checks,
  };

  const totalLatency = Date.now() - startTime;

  return NextResponse.json(response, {
    status: overallStatus === 'unhealthy' ? 503 : 200,
    headers: {
      'Cache-Control': 'no-store',
      'X-Response-Time': `${totalLatency}ms`,
    },
  });
}
