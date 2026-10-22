import { Injectable, BadRequestException, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { MedicalDataSanitizerService } from './medical-data-sanitizer.service';

@Injectable()
export class MedicalDataValidationPipe implements PipeTransform {
  constructor(private sanitizer: MedicalDataSanitizerService) {}

  async transform(value: any, metadata: ArgumentMetadata) {
    if (!value) {
      throw new BadRequestException('Validation failed: No data provided');
    }

    if (metadata.type === 'query' && metadata.metatype === Number) {
      const queryParam = metadata.data as string;
      if (['page', 'pageSize', 'offset'].includes(queryParam)) {
        if (value === undefined || value === null || value === '') {
          if (queryParam === 'page') {
            return 1;
          }
          if (queryParam === 'pageSize') {
            return 20;
          }
          if (queryParam === 'offset') {
            return 0;
          }
        }

        const parsed = Number(value);
        if (Number.isInteger(parsed)) {
          return parsed;
        }
      }
    }

    // Some route arguments expose primitive metatypes (String/Boolean/etc.); validate only class-based DTOs.
    const metatype = metadata.metatype as any;
    const shouldValidate = metatype && ![String, Boolean, Number, Array, Object].includes(metatype);

    if (!shouldValidate) {
      return this.sanitizer.sanitizeObject(value);
    }

    const object = plainToInstance(metatype, value);
    const errors = await validate(object);

    if (errors.length > 0) {
      const messages = errors.map((error) => ({
        field: error.property,
        message: 'Medical data validation failed',
      }));

      throw new BadRequestException({
        statusCode: 400,
        message: 'Medical data validation failed',
        errors: messages,
      });
    }

    return this.sanitizer.sanitizeObject(value);
  }
}
