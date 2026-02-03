/**
 * Centralized test configuration.
 * All ports and URLs should be read from here, not hardcoded.
 */

export interface TestConfig {
  convexBackendUrl: string;
  convexBackendPort: number;
  webAppUrl: string;
  webAppPort: number;
  playwrightBaseUrl: string;
  adminKey: string;
}

function getPort(envVar: string, defaultPort: number): number {
  const value = process.env[envVar];
  return value ? parseInt(value, 10) : defaultPort;
}

function getUrl(envVar: string, defaultUrl: string): string {
  return process.env[envVar] || defaultUrl;
}

export function getTestConfig(): TestConfig {
  const convexPort = getPort('CONVEX_BACKEND_PORT', 3210);
  const webAppPort = getPort('WEB_APP_PORT', 3001);

  return {
    convexBackendPort: convexPort,
    convexBackendUrl: getUrl('CONVEX_BACKEND_URL', `http://127.0.0.1:${convexPort}`),
    webAppPort: webAppPort,
    webAppUrl: getUrl('WEB_APP_URL', `http://localhost:${webAppPort}`),
    playwrightBaseUrl: getUrl('PLAYWRIGHT_BASE_URL', `http://localhost:${webAppPort}`),
    adminKey: process.env.CONVEX_ADMIN_KEY || '0135d8598650f8f5cb0f30c34ec2e2bb62793bc28717c8eb6fb577996d50be5f4281b59181095065c5d0f86a2c31ddbe9b597ec62b47ded69782cd',
  };
}

// Export singleton for easy import
export const testConfig = getTestConfig();
