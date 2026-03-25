import { Injectable, BadRequestException, ValidationPipe as NestValidationPipe } from '@nestjs/common';
import { I18nService } from './i18n.service';
import { ValidationError } from 'class-validator';

@Injectable()
export class I18nValidationPipe extends NestValidationPipe {
  constructor(private readonly i18nService: I18nService) {
    super({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    });
  }

  async transform(value: any, metadata: any) {
    try {
      return await super.transform(value, metadata);
    } catch (error) {
      if (error instanceof BadRequestException) {
        const response = error.getResponse() as any;

        if (Array.isArray(response.message)) {
          // Transform class-validator errors to translated messages
          const translatedErrors: Record<string, string[]> = {};

          response.message.forEach((err: ValidationError) => {
            const field = err.property;
            const constraints = err.constraints || {};

            translatedErrors[field] = Object.entries(constraints).map(([constraint, message]) => {
              // Extract the constraint type (minLength, maxLength, etc.)
              const constraintType = this.extractConstraintType(constraint);

              // Get variables from the constraint message if available
              const variables = this.extractVariables(message as string);

              return this.i18nService.translateValidationError(field, constraintType, variables);
            });
          });

          throw new BadRequestException({
            statusCode: 400,
            message: 'Validation failed',
            errors: translatedErrors,
          });
        }
      }

      throw error;
    }
  }

  /**
   * Extract constraint type from validation constraint
   * minLength -> minLength, isEmail -> isEmail, etc.
   */
  private extractConstraintType(constraint: string): string {
    return constraint.toLowerCase();
  }

  /**
   * Extract variables from constraint message
   * "must be at least 12 characters" -> { min: 12 }
   */
  private extractVariables(message: string): Record<string, any> {
    const variables: Record<string, any> = {};

    // Extract minLength: "must be at least X characters" or "must be longer than X characters"
    const minMatch = message.match(/(?:at least|longer than)\s+(\d+)/i);
    if (minMatch) {
      variables.min = parseInt(minMatch[1], 10);
    }

    // Extract maxLength: "must be at most X characters" or "must be shorter than X characters"
    const maxMatch = message.match(/(?:at most|shorter than)\s+(\d+)/i);
    if (maxMatch) {
      variables.max = parseInt(maxMatch[1], 10);
    }

    return variables;
  }
}
