import { execSync } from 'node:child_process';

/**
 * Detect whether Docker is available so integration suites can skip gracefully
 * in environments without it (e.g. agentic sessions, restricted CI).
 */
export function isDockerAvailable(): boolean {
  try {
    execSync('docker info', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export const describeIfDocker = isDockerAvailable() ? describe : describe.skip;
