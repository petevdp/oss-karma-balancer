import { logger, ppObj, setupLogger } from './services/logger';
import { setupEnvironment } from './services/environment';
import { setupCli } from './services/cli';
import { config, setupConfig } from './services/config';
import { Future } from 'lib/future';
const f = new Future();

export function main() {
  setupEnvironment();
  setupCli();
  setupLogger();
  setupConfig();
  logger.info(ppObj(config));
  logger.info('wow');
}

