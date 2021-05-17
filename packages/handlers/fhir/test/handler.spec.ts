import FhirHandler from '../src';
import InMemoryLRUCache from '@graphql-mesh/cache-inmemory-lru';
import { PubSub } from 'graphql-subscriptions';
import { introspectionFromSchema, lexicographicSortSchema } from 'graphql';
import { InMemoryStoreStorageAdapter, MeshStore } from '@graphql-mesh/store';

describe('fhir', () => {
  it('can generate valid fhir schema', async () => {
    const handler = new FhirHandler({
      name: 'FHIR',
      config: {},
      pubsub: new PubSub(),
      cache: new InMemoryLRUCache(),
      store: new MeshStore('fhir', new InMemoryStoreStorageAdapter(), {
        readonly: false,
        validate: false,
      }),
    });
    const { schema } = await handler.getMeshSource();
    expect(
      introspectionFromSchema(lexicographicSortSchema(schema), {
        descriptions: false,
      })
    ).toMatchSnapshot();
  });
});
