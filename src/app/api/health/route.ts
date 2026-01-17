import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface HealthCheck {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  checks: {
    database: ComponentHealth;
    environment: ComponentHealth;
  };
}

interface ComponentHealth {
  status: 'pass' | 'fail';
  latency_ms?: number;
  message?: string;
}

export async function GET() {
  const startTime = Date.now();
  const checks: HealthCheck['checks'] = {
    database: { status: 'fail' },
    environment: { status: 'fail' },
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

  // Determine overall status
  const allPassing = Object.values(checks).every((c) => c.status === 'pass');
  const allFailing = Object.values(checks).every((c) => c.status === 'fail');

  let overallStatus: HealthCheck['status'];
  if (allPassing) {
    overallStatus = 'healthy';
  } else if (allFailing) {
    overallStatus = 'unhealthy';
  } else {
    overallStatus = 'degraded';
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
