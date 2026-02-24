import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan } from 'typeorm';
import {
  RemoteMonitoringData,
  MonitoringDataType,
  AlertLevel,
} from '../entities/remote-monitoring-data.entity';

export interface CreateMonitoringDataDto {
  patientId: string;
  dataType: MonitoringDataType;
  data: any;
  deviceId?: string;
  deviceType?: string;
  isAutomatedReading?: boolean;
}

export interface MonitoringAlert {
  alertLevel: AlertLevel;
  message: string;
  requiresProviderReview: boolean;
}

@Injectable()
export class RemoteMonitoringService {
  constructor(
    @InjectRepository(RemoteMonitoringData)
    private monitoringRepository: Repository<RemoteMonitoringData>,
  ) {}

  async recordMonitoringData(dto: CreateMonitoringDataDto): Promise<RemoteMonitoringData> {
    // Validate data based on type
    this.validateMonitoringData(dto.dataType, dto.data);

    // Analyze data and determine alert level
    const alert = this.analyzeDataForAlerts(dto.dataType, dto.data);

    const monitoringData = this.monitoringRepository.create({
      ...dto,
      recordedAt: new Date(),
      alertLevel: alert.alertLevel,
      alertMessage: alert.message,
      requiresProviderReview: alert.requiresProviderReview,
      isValidated: true,
    });

    const savedData = await this.monitoringRepository.save(monitoringData);

    // Calculate trend if historical data exists
    await this.calculateTrend(savedData);

    return savedData;
  }

  async getPatientMonitoringData(
    patientId: string,
    dataType?: MonitoringDataType,
    startDate?: Date,
    endDate?: Date,
  ): Promise<RemoteMonitoringData[]> {
    const whereClause: any = { patientId };

    if (dataType) {
      whereClause.dataType = dataType;
    }

    if (startDate && endDate) {
      whereClause.recordedAt = Between(startDate, endDate);
    }

    return this.monitoringRepository.find({
      where: whereClause,
      order: { recordedAt: 'DESC' },
    });
  }

  async getLatestReadings(
    patientId: string,
    dataTypes: MonitoringDataType[],
  ): Promise<Record<MonitoringDataType, RemoteMonitoringData>> {
    const latestReadings: any = {};

    for (const dataType of dataTypes) {
      const reading = await this.monitoringRepository.findOne({
        where: { patientId, dataType },
        order: { recordedAt: 'DESC' },
      });

      if (reading) {
        latestReadings[dataType] = reading;
      }
    }

    return latestReadings;
  }

  async getCriticalAlerts(providerId?: string): Promise<RemoteMonitoringData[]> {
    const whereClause: any = {
      alertLevel: AlertLevel.CRITICAL,
      reviewedByProvider: false,
    };

    if (providerId) {
      whereClause.providerId = providerId;
    }

    return this.monitoringRepository.find({
      where: whereClause,
      order: { recordedAt: 'DESC' },
      take: 50,
    });
  }

  async reviewMonitoringData(
    dataId: string,
    providerId: string,
    comments: string,
  ): Promise<RemoteMonitoringData> {
    const data = await this.findOne(dataId);

    data.reviewedByProvider = true;
    data.reviewedBy = providerId;
    data.reviewedAt = new Date();
    data.providerComments = comments;

    return this.monitoringRepository.save(data);
  }

  async getActionableInsights(patientId: string): Promise<any> {
    const recentData = await this.getPatientMonitoringData(
      patientId,
      undefined,
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      new Date(),
    );

    const insights = {
      criticalAlerts: [],
      warnings: [],
      trends: [],
      recommendations: [],
    };

    // Analyze blood pressure
    const bpReadings = recentData.filter((d) => d.dataType === MonitoringDataType.BLOOD_PRESSURE);
    if (bpReadings.length > 0) {
      const avgSystolic =
        bpReadings.reduce((sum, r) => sum + (r.data.systolic || 0), 0) / bpReadings.length;
      const avgDiastolic =
        bpReadings.reduce((sum, r) => sum + (r.data.diastolic || 0), 0) / bpReadings.length;

      if (avgSystolic > 140 || avgDiastolic > 90) {
        insights.warnings.push({
          type: 'blood_pressure',
          message: `Average BP: ${Math.round(avgSystolic)}/${Math.round(avgDiastolic)} - Consider medication adjustment`,
        });
      }
    }

    // Analyze glucose levels
    const glucoseReadings = recentData.filter(
      (d) => d.dataType === MonitoringDataType.BLOOD_GLUCOSE,
    );
    if (glucoseReadings.length > 0) {
      const highReadings = glucoseReadings.filter((r) => r.data.glucoseLevel > 180);
      if (highReadings.length > glucoseReadings.length * 0.3) {
        insights.warnings.push({
          type: 'blood_glucose',
          message: `${highReadings.length} high glucose readings in past week`,
        });
      }
    }

    // Check medication adherence
    const medAdherence = recentData.filter(
      (d) => d.dataType === MonitoringDataType.MEDICATION_ADHERENCE,
    );
    if (medAdherence.length > 0) {
      const takenCount = medAdherence.filter((m) => m.data.taken).length;
      const adherenceRate = (takenCount / medAdherence.length) * 100;

      if (adherenceRate < 80) {
        insights.recommendations.push({
          type: 'medication_adherence',
          message: `Medication adherence at ${Math.round(adherenceRate)}% - Consider intervention`,
        });
      }
    }

    // Identify trends
    for (const dataType of Object.values(MonitoringDataType)) {
      const typeData = recentData.filter((d) => d.dataType === dataType);
      if (typeData.length > 0 && typeData[0].trend) {
        insights.trends.push({
          dataType,
          trend: typeData[0].trend,
        });
      }
    }

    return insights;
  }

  async generatePatientReport(patientId: string, startDate: Date, endDate: Date): Promise<any> {
    const data = await this.getPatientMonitoringData(patientId, undefined, startDate, endDate);

    const report = {
      patientId,
      reportPeriod: { startDate, endDate },
      summary: {
        totalReadings: data.length,
        criticalAlerts: data.filter((d) => d.alertLevel === AlertLevel.CRITICAL).length,
        warnings: data.filter((d) => d.alertLevel === AlertLevel.WARNING).length,
        dataTypes: [...new Set(data.map((d) => d.dataType))],
      },
      vitals: {},
      alerts: [],
      trends: [],
    };

    // Group by data type
    const groupedData = data.reduce(
      (acc, item) => {
        if (!acc[item.dataType]) {
          acc[item.dataType] = [];
        }
        acc[item.dataType].push(item);
        return acc;
      },
      {} as Record<string, RemoteMonitoringData[]>,
    );

    // Calculate statistics for each type
    for (const [dataType, readings] of Object.entries(groupedData)) {
      report.vitals[dataType] = this.calculateStatistics(readings);
    }

    // Collect alerts
    report.alerts = data
      .filter((d) => d.alertLevel !== AlertLevel.NORMAL)
      .map((d) => ({
        date: d.recordedAt,
        type: d.dataType,
        level: d.alertLevel,
        message: d.alertMessage,
      }));

    return report;
  }

  private validateMonitoringData(dataType: MonitoringDataType, data: any): void {
    switch (dataType) {
      case MonitoringDataType.BLOOD_PRESSURE:
        if (!data.systolic || !data.diastolic) {
          throw new BadRequestException('Blood pressure requires systolic and diastolic values');
        }
        if (data.systolic < 60 || data.systolic > 250) {
          throw new BadRequestException('Invalid systolic blood pressure value');
        }
        if (data.diastolic < 40 || data.diastolic > 150) {
          throw new BadRequestException('Invalid diastolic blood pressure value');
        }
        break;

      case MonitoringDataType.BLOOD_GLUCOSE:
        if (!data.glucoseLevel) {
          throw new BadRequestException('Glucose level is required');
        }
        if (data.glucoseLevel < 20 || data.glucoseLevel > 600) {
          throw new BadRequestException('Invalid glucose level');
        }
        break;

      case MonitoringDataType.HEART_RATE:
        if (!data.heartRate) {
          throw new BadRequestException('Heart rate is required');
        }
        if (data.heartRate < 30 || data.heartRate > 250) {
          throw new BadRequestException('Invalid heart rate');
        }
        break;

      case MonitoringDataType.OXYGEN_SATURATION:
        if (!data.oxygenSaturation) {
          throw new BadRequestException('Oxygen saturation is required');
        }
        if (data.oxygenSaturation < 70 || data.oxygenSaturation > 100) {
          throw new BadRequestException('Invalid oxygen saturation');
        }
        break;
    }
  }

  private analyzeDataForAlerts(dataType: MonitoringDataType, data: any): MonitoringAlert {
    let alertLevel = AlertLevel.NORMAL;
    let message = '';
    let requiresProviderReview = false;

    switch (dataType) {
      case MonitoringDataType.BLOOD_PRESSURE:
        if (data.systolic >= 180 || data.diastolic >= 120) {
          alertLevel = AlertLevel.CRITICAL;
          message = 'Hypertensive crisis - immediate medical attention required';
          requiresProviderReview = true;
        } else if (data.systolic >= 140 || data.diastolic >= 90) {
          alertLevel = AlertLevel.WARNING;
          message = 'Elevated blood pressure';
          requiresProviderReview = true;
        } else if (data.systolic < 90 || data.diastolic < 60) {
          alertLevel = AlertLevel.WARNING;
          message = 'Low blood pressure';
          requiresProviderReview = true;
        }
        break;

      case MonitoringDataType.BLOOD_GLUCOSE:
        if (data.glucoseLevel < 54) {
          alertLevel = AlertLevel.CRITICAL;
          message = 'Severe hypoglycemia';
          requiresProviderReview = true;
        } else if (data.glucoseLevel > 400) {
          alertLevel = AlertLevel.CRITICAL;
          message = 'Severe hyperglycemia';
          requiresProviderReview = true;
        } else if (data.glucoseLevel < 70) {
          alertLevel = AlertLevel.WARNING;
          message = 'Low blood glucose';
        } else if (data.glucoseLevel > 250) {
          alertLevel = AlertLevel.WARNING;
          message = 'High blood glucose';
        }
        break;

      case MonitoringDataType.OXYGEN_SATURATION:
        if (data.oxygenSaturation < 88) {
          alertLevel = AlertLevel.CRITICAL;
          message = 'Critical low oxygen saturation';
          requiresProviderReview = true;
        } else if (data.oxygenSaturation < 92) {
          alertLevel = AlertLevel.WARNING;
          message = 'Low oxygen saturation';
          requiresProviderReview = true;
        }
        break;

      case MonitoringDataType.HEART_RATE:
        if (data.heartRate < 40 || data.heartRate > 150) {
          alertLevel = AlertLevel.CRITICAL;
          message = 'Abnormal heart rate';
          requiresProviderReview = true;
        } else if (data.heartRate < 50 || data.heartRate > 120) {
          alertLevel = AlertLevel.WARNING;
          message = 'Heart rate outside normal range';
        }
        break;
    }

    return { alertLevel, message, requiresProviderReview };
  }

  private async calculateTrend(currentData: RemoteMonitoringData): Promise<void> {
    const historicalData = await this.monitoringRepository.find({
      where: {
        patientId: currentData.patientId,
        dataType: currentData.dataType,
        recordedAt: LessThan(currentData.recordedAt),
      },
      order: { recordedAt: 'DESC' },
      take: 10,
    });

    if (historicalData.length < 3) {
      return; // Need at least 3 data points for trend
    }

    // Calculate trend based on primary metric
    const values = this.extractPrimaryValues([currentData, ...historicalData]);
    const recentAvg = values.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = values.slice(3, 6).reduce((a, b) => a + b, 0) / Math.min(3, values.length - 3);

    const percentageChange = ((recentAvg - olderAvg) / olderAvg) * 100;

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(percentageChange) < 5) {
      direction = 'stable';
    } else if (percentageChange > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    currentData.trend = {
      direction,
      percentageChange: Math.round(percentageChange * 10) / 10,
      comparisonPeriod: '7_days',
    };

    await this.monitoringRepository.save(currentData);
  }

  private extractPrimaryValues(data: RemoteMonitoringData[]): number[] {
    return data
      .map((d) => {
        switch (d.dataType) {
          case MonitoringDataType.BLOOD_PRESSURE:
            return d.data.systolic;
          case MonitoringDataType.BLOOD_GLUCOSE:
            return d.data.glucoseLevel;
          case MonitoringDataType.HEART_RATE:
            return d.data.heartRate;
          case MonitoringDataType.OXYGEN_SATURATION:
            return d.data.oxygenSaturation;
          case MonitoringDataType.WEIGHT:
            return d.data.weight;
          case MonitoringDataType.TEMPERATURE:
            return d.data.temperature;
          default:
            return 0;
        }
      })
      .filter((v) => v > 0);
  }

  private calculateStatistics(readings: RemoteMonitoringData[]): any {
    if (readings.length === 0) return null;

    const values = this.extractPrimaryValues(readings);
    const sum = values.reduce((a, b) => a + b, 0);
    const avg = sum / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);

    return {
      count: readings.length,
      average: Math.round(avg * 10) / 10,
      min,
      max,
      latestReading: readings[0].data,
      latestDate: readings[0].recordedAt,
    };
  }

  async findOne(id: string): Promise<RemoteMonitoringData> {
    const data = await this.monitoringRepository.findOne({ where: { id } });

    if (!data) {
      throw new NotFoundException(`Monitoring data with ID ${id} not found`);
    }

    return data;
  }
}
