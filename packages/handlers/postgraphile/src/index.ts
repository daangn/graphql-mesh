/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  GetMeshSourceOptions,
  MeshHandler,
  MeshSource,
  YamlConfig,
  MeshPubSub,
  KeyValueCache,
} from '@graphql-mesh/types';
import { subscribe } from 'graphql';
import { withPostGraphileContext, Plugin } from 'postgraphile';
import { getPostGraphileBuilder } from 'postgraphile-core';
import { Pool } from 'pg';
import { join } from 'path';
import { tmpdir } from 'os';
import { loadFromModuleExportExpression, readFileOrUrlWithCache, jitExecutorFactory } from '@graphql-mesh/utils';
import { ExecutionParams } from '@graphql-tools/delegate';
import { PredefinedProxyOptions } from '@graphql-mesh/store';

export default class PostGraphileHandler implements MeshHandler {
  private name: string;
  private config: YamlConfig.PostGraphileHandler;
  private baseDir: string;
  private cache: KeyValueCache;
  private pubsub: MeshPubSub;
  private pgCache: any;

  constructor({ name, config, baseDir, cache, pubsub, store }: GetMeshSourceOptions<YamlConfig.PostGraphileHandler>) {
    this.name = name;
    this.config = config;
    this.baseDir = baseDir;
    this.cache = cache;
    this.pubsub = pubsub;
    this.pgCache = store.proxy('pgCache.json', PredefinedProxyOptions.JsonWithoutValidation);
  }

  async getMeshSource(): Promise<MeshSource> {
    let pgPool: Pool;

    if (typeof this.config?.pool === 'string') {
      pgPool = await loadFromModuleExportExpression<any>(this.config.pool, { cwd: this.baseDir });
    }

    if (!pgPool || !('connect' in pgPool)) {
      pgPool = new Pool({
        connectionString: this.config.connectionString,
        ...this.config?.pool,
      });
    }

    this.pubsub.subscribe('destroy', () => pgPool.end());

    const cacheKey = this.name + '_introspection.json';

    const dummyCacheFilePath = join(tmpdir(), cacheKey);
    let cachedIntrospection = await this.pgCache.get();

    let writeCache: () => Promise<void>;

    const appendPlugins = await Promise.all<Plugin>(
      (this.config.appendPlugins || []).map(pluginName =>
        loadFromModuleExportExpression<any>(pluginName, { cwd: this.baseDir })
      )
    );
    const skipPlugins = await Promise.all<Plugin>(
      (this.config.skipPlugins || []).map(pluginName =>
        loadFromModuleExportExpression<any>(pluginName, { cwd: this.baseDir })
      )
    );
    const options = await loadFromModuleExportExpression<any>(this.config.options, { cwd: this.baseDir });

    const builder = await getPostGraphileBuilder(pgPool, this.config.schemaName || 'public', {
      dynamicJson: true,
      subscriptions: 'subscriptions' in this.config ? this.config.subscriptions : true,
      live: 'live' in this.config ? this.config.live : true,
      readCache: cachedIntrospection,
      writeCache: !cachedIntrospection && dummyCacheFilePath,
      setWriteCacheCallback: fn => {
        writeCache = fn;
      },
      appendPlugins,
      skipPlugins,
      ...options,
    });

    const schema = builder.buildSchema();

    if (!cachedIntrospection) {
      await writeCache();
      cachedIntrospection = await readFileOrUrlWithCache(dummyCacheFilePath, this.cache, {
        cwd: this.baseDir,
      });
      await this.pgCache.set(cachedIntrospection);
    }

    const jitExecutor = jitExecutorFactory(schema, this.name);
    const executor: any = ({ document, variables, context: meshContext, info }: ExecutionParams) =>
      withPostGraphileContext({ pgPool }, async postgraphileContext =>
        jitExecutor({
          document,
          variables,
          context: {
            ...meshContext,
            ...postgraphileContext,
          },
          info,
        })
      );

    return {
      schema,
      executor,
      subscriber: ({ document, variables, context: meshContext }) =>
        withPostGraphileContext(
          { pgPool },
          // Execute your GraphQL query in this function with the provided
          // `context` object, which should NOT be used outside of this
          // function.
          postgraphileContext =>
            subscribe({
              schema, // The schema from `createPostGraphileSchema`
              document,
              contextValue: { ...postgraphileContext, ...meshContext }, // You can add more to context if you like
              variableValues: variables,
            }) as any
        ) as any,
    };
  }
}
