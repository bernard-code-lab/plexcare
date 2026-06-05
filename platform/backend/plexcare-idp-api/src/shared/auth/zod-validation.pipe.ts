import { ArgumentMetadata, BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Generic pipe that validates the incoming payload against a Zod schema. Use
 * `new ZodValidationPipe(MySchema)` per controller handler argument.
 */
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown, _meta: ArgumentMetadata): T {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        message: parsed.error.issues.map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`),
      });
    }
    return parsed.data;
  }
}
