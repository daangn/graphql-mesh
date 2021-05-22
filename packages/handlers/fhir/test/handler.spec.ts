import FhirHandler from '../src';
import StoreCache from '@graphql-mesh/cache-store';
import { PubSub } from 'graphql-subscriptions';
import { introspectionFromSchema, lexicographicSortSchema } from 'graphql';
import { InMemoryStoreStorageAdapter, MeshStore } from '@graphql-mesh/store';

describe('fhir', () => {
  it('can generate valid fhir schema', async () => {
    const store = new MeshStore('fhir', new InMemoryStoreStorageAdapter(), {
      readonly: false,
      validate: false,
    });
    const handler = new FhirHandler({
      name: 'FHIR',
      config: {},
      pubsub: new PubSub(),
      cache: new StoreCache(store.child('cache')),
      store,
    });
    const { schema } = await handler.getMeshSource();
    expect(
      introspectionFromSchema(lexicographicSortSchema(schema), {
        descriptions: false,
      })
    ).toMatchSnapshot();
  });
});
