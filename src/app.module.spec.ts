import { Test } from '@nestjs/testing';
import { AppModule } from './app.module';

describe('AppModule', () => {
  it('registers each imported module exactly once', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    // Access the metadata used by Nest to build the module graph.
    const imports: unknown[] =
      Reflect.getMetadata('imports', AppModule) ?? [];

    const seen = new Set<unknown>();
    const duplicates: unknown[] = [];

    for (const imported of imports) {
      if (seen.has(imported)) {
        duplicates.push(imported);
      } else {
        seen.add(imported);
      }
    }

    const duplicateNames = duplicates.map(
      (dup) => (dup as { name?: string })?.name ?? String(dup),
    );

    expect(duplicateNames).toEqual([]);

    await moduleRef.close();
  });
});
