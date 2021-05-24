import { writeFile, writeJSON } from '@graphql-mesh/utils';
import { GraphQLSchema, introspectionFromSchema } from 'graphql';
import { printSchemaWithDirectives } from '@graphql-tools/utils';
import { join } from 'path';

export async function dumpSchema(schema: GraphQLSchema, cwd: string) {
  const sdl = printSchemaWithDirectives(schema);
  const introspection = introspectionFromSchema(schema);
  await Promise.all([
    writeFile(join(cwd, '.mesh/schema.graphql'), sdl),
    writeJSON(join(cwd, '.mesh/schema.json'), introspection),
  ]);
}
