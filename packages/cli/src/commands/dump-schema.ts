import { GraphQLSchema } from 'graphql';
import { MeshStore, PredefinedProxyOptions } from '@graphql-mesh/store';

export async function dumpSchema(schema: GraphQLSchema, cwd: string, store: MeshStore) {
  const sdl = store.proxy('schema.graphql', PredefinedProxyOptions.GraphQLSchemaWithDiffing);
  await sdl.getWithSet(() => schema);
}
