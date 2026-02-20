import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { LabAnalytics, MetricType, MetricPeriod } from '../entities/lab-analytics.entity';
import { LabOrder, OrderStatus } from '../entities/lab-order.entity';
import { LabResult, ResultStatus } from '../entities/lab-result.entity';

@Injectable()
export class LabAnalyticsService {
    constructor(
        @InjectRepository(LabAnalytics)
        private analyticsRepository: Repository<LabAnalytics>,
        @InjectRepository(LabOrder)
        private labOrderRepository: Repository<LabOrder>,
        @InjectRepository(LabResult)
        private labResultRepository: Repository<LabResult>,
    ) {}

    async calculateTurnaroundTime(period: MetricPeriod, startDate: Date, endDate: Date): Promise<LabAnalytics> {
        const orders = await this.labOrderRepository.find({
            where: {
                createdAt: Between(startDate, endDate),
                status: OrderStatus.COMPLETED
            },
        });

        const turnaroundTimes = orders
            .filter(order => order.completedDate)
            .map(order => {
                const orderDate = new Date(order.createdAt);
                const completedDate = new Date(order.completedDate);
                return (completedDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60); // in hours
            });

        const avgTurnaroundTime = turnaroundTimes.length > 0 
            ? turnaroundTimes.reduce((sum, time) => sum + time, 0) / turnaroundTimes.length 
            : 0;

        const analytics = this.analyticsRepository.create({
            metricType: MetricType.TURNAROUND_TIME,
            period,
            periodStart: startDate,
            periodEnd: endDate,
            metricValue: avgTurnaroundTime,
            unit: 'hours',
            targetValue: 24, // 24 hours target
            metadata: {
                totalOrders: orders.length,
                completedOrders: turnaroundTimes.length
            }
        });

        return this.analyticsRepository.save(analytics);
    }

    async calculateThroughput(period: MetricPeriod, startDate: Date, endDate: Date): Promise<LabAnalytics> {
        const totalTests = await this.labResultRepository.count({
            where: {
                performedDate: Between(startDate, endDate)
            }
        });

        const periodHours = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60);
        const throughputPerHour = totalTests / periodHours;

        const analytics = this.analyticsRepository.create({
            metricType: MetricType.THROUGHPUT,
            period,
            periodStart: startDate,
            periodEnd: endDate,
            metricValue: throughputPerHour,
            unit: 'tests/hour',
            metadata: {
                totalTests,
                periodHours
            }
        });

        return this.analyticsRepository.save(analytics);
    }

    async calculateErrorRate(period: MetricPeriod, startDate: Date, endDate: Date): Promise<LabAnalytics> {
        const totalResults = await this.labResultRepository.count({
            where: {
                performedDate: Between(startDate, endDate)
            }
        });

        // Simulate error detection logic
        const errorResults = await this.labResultRepository.count({
            where: {
                performedDate: Between(startDate, endDate),
                status: ResultStatus.CANCELLED
            }
        });

        const errorRate = totalResults > 0 ? (errorResults / totalResults) * 100 : 0;

        const analytics = this.analyticsRepository.create({
            metricType: MetricType.ERROR_RATE,
            period,
            periodStart: startDate,
            periodEnd: endDate,
            metricValue: errorRate,
            unit: 'percentage',
            targetValue: 2, // 2% target error rate
            metadata: {
                totalResults,
                errorResults
            }
        });

        return this.analyticsRepository.save(analytics);
    }

    async getMetricsByType(metricType: MetricType, limit: number = 10): Promise<LabAnalytics[]> {
        return this.analyticsRepository.find({
            where: { metricType },
            order: { periodStart: 'DESC' },
            take: limit
        });
    }

    async getMetricsByPeriod(period: MetricPeriod, startDate: Date, endDate: Date): Promise<LabAnalytics[]> {
        return this.analyticsRepository.find({
            where: {
                period,
                periodStart: Between(startDate, endDate)
            },
            order: { metricType: 'ASC', periodStart: 'DESC' }
        });
    }

    async getDashboardMetrics(): Promise<any> {
        const today = new Date();
        const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
        const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

        const [
            dailyTurnaround,
            dailyThroughput,
            dailyErrorRate,
            weeklyMetrics
        ] = await Promise.all([
            this.calculateTurnaroundTime(MetricPeriod.DAILY, yesterday, today),
            this.calculateThroughput(MetricPeriod.DAILY, yesterday, today),
            this.calculateErrorRate(MetricPeriod.DAILY, yesterday, today),
            this.getMetricsByPeriod(MetricPeriod.WEEKLY, lastWeek, today)
        ]);

        return {
            daily: {
                turnaroundTime: dailyTurnaround,
                throughput: dailyThroughput,
                errorRate: dailyErrorRate
            },
            weekly: weeklyMetrics,
            trends: await this.calculateTrends()
        };
    }

    private async calculateTrends(): Promise<any> {
        const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const today = new Date();

        const metrics = await this.analyticsRepository.find({
            where: {
                periodStart: Between(last30Days, today),
                period: MetricPeriod.DAILY
            },
            order: { periodStart: 'ASC' }
        });

        const groupedMetrics = metrics.reduce<Record<string, LabAnalytics[]>>((acc, metric) => {
            if (!acc[metric.metricType]) acc[metric.metricType] = [];
            acc[metric.metricType].push(metric);
            return acc;
        }, {});

        return Object.keys(groupedMetrics).reduce<Record<string, any>>((trends, metricType) => {
            const values = groupedMetrics[metricType].map(m => m.metricValue);
            const trend = values.length > 1 
                ? values[values.length - 1] - values[0] 
                : 0;
            
            trends[metricType] = {
                trend: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
                change: Math.abs(trend),
                dataPoints: values.length
            };
            
            return trends;
        }, {});
    }
}