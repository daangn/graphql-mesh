import ThriftHandler from '../src';
import StoreCache from '@graphql-mesh/cache-store';
import { join } from 'path';
import { printSchema } from 'graphql';
import { PubSub } from 'graphql-subscriptions';
import { InMemoryStoreStorageAdapter, MeshStore } from '@graphql-mesh/store';

describe('thrift', () => {
  it('should create a GraphQL Schema from Thrift IDL', async () => {
    const store = new MeshStore('.mesh', new InMemoryStoreStorageAdapter(), { readonly: false, validate: false });
    const thriftHandler = new ThriftHandler({
      name: 'Twitter',
      config: {
        idl: join(__dirname, './fixtures/twitter.thrift'),
        hostName: 'localhost',
        port: 4444,
        path: '/twitter',
        serviceName: 'twitter-service',
      },
      cache: new StoreCache(store.child('cache')),
      pubsub: new PubSub(),
      store,
    });
    const source = await thriftHandler.getMeshSource();
    expect(printSchema(source.schema)).toMatchSnapshot();
  });
});
