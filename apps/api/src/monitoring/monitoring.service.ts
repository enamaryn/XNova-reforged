import { Injectable } from '@nestjs/common';

export interface Metric {
  name: string;
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface AggregatedMetric {
  count: number;
  sum: number;
  avg: number;
  min: number;
  max: number;
}

@Injectable()
export class MonitoringService {
  private metrics: Metric[] = [];
  private readonly maxMetrics = 1000;

  recordMetric(name: string, value: number, labels?: Record<string, string>) {
    this.metrics.push({
      name,
      value,
      timestamp: Date.now(),
      labels,
    });

    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  getMetrics(name?: string): Metric[] {
    if (name) {
      return this.metrics.filter((metric) => metric.name === name);
    }
    return this.metrics;
  }

  getAggregatedMetrics(): Record<string, AggregatedMetric> {
    const aggregated: Record<string, AggregatedMetric> = {};

    this.metrics.forEach((metric) => {
      if (!aggregated[metric.name]) {
        aggregated[metric.name] = {
          count: 0,
          sum: 0,
          avg: 0,
          min: Infinity,
          max: -Infinity,
        };
      }

      const agg = aggregated[metric.name];
      agg.count += 1;
      agg.sum += metric.value;
      agg.min = Math.min(agg.min, metric.value);
      agg.max = Math.max(agg.max, metric.value);
      agg.avg = agg.sum / agg.count;
    });

    return aggregated;
  }

  clearMetrics() {
    this.metrics = [];
  }
}
