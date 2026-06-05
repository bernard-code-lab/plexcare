import { Controller, Get, Header } from '@nestjs/common';
import { metricsRegistry } from './metrics.registry';

@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('content-type', 'text/plain; version=0.0.4; charset=utf-8')
  async scrape(): Promise<string> {
    return metricsRegistry.metrics();
  }
}
