import { isAbsolute } from 'path';
import { makeAugmentedSchema, inferSchema } from 'neo4j-graphql-js';
import neo4j, { Driver } from 'neo4j-driver';
import { YamlConfig, MeshHandler, GetMeshSourceOptions, MeshPubSub } from '@graphql-mesh/types';
import { loadTypedefs } from '@graphql-tools/load';
import { GraphQLFileLoader } from '@graphql-tools/graphql-file-loader';
import { CodeFileLoader } from '@graphql-tools/code-file-loader';
import { mergeTypeDefs } from '@graphql-tools/merge';
import { DocumentNode, parse } from 'graphql';
import { PredefinedProxyOptions, StoreProxy } from '@graphql-mesh/store';

export default class Neo4JHandler implements MeshHandler {
  private config: YamlConfig.Neo4JHandler;
  private baseDir: string;
  private pubsub: MeshPubSub;
  private typeDefs: StoreProxy<DocumentNode>;

  constructor({ config, baseDir, pubsub, store }: GetMeshSourceOptions<YamlConfig.Neo4JHandler>) {
    this.config = config;
    this.baseDir = baseDir;
    this.pubsub = pubsub;
    this.typeDefs = store.proxy('typeDefs.json', PredefinedProxyOptions.JsonWithoutValidation);
  }

  private driver: Driver;

  getDriver() {
    if (!this.driver) {
      this.driver = neo4j.driver(this.config.url, neo4j.auth.basic(this.config.username, this.config.password));
      this.pubsub.subscribe('destroy', () => this.driver.close());
    }
    return this.driver;
  }

  async getCachedTypeDefs() {
    let typeDefs = await this.typeDefs.get();
    if (!typeDefs) {
      if (this.config.typeDefs) {
        const typeDefsArr = await loadTypedefs(this.config.typeDefs, {
          cwd: isAbsolute(this.config.typeDefs) ? null : this.baseDir,
          loaders: [new CodeFileLoader(), new GraphQLFileLoader()],
          assumeValid: true,
          assumeValidSDL: true,
        });
        typeDefs = mergeTypeDefs(typeDefsArr.map(source => source.document));
      } else {
        typeDefs = await inferSchema(this.getDriver(), {
          alwaysIncludeRelationships: this.config.alwaysIncludeRelationships,
        });
        if (typeof typeDefs === 'string') {
          typeDefs = parse(typeDefs);
        }
      }
      await this.typeDefs.set(typeDefs);
    }
    return typeDefs;
  }

  async getMeshSource() {
    const typeDefs: DocumentNode | string = await this.getCachedTypeDefs();

    const schema = makeAugmentedSchema({ typeDefs, config: { experimental: true } });

    return {
      schema,
      contextBuilder: async () => ({ driver: this.getDriver(), neo4jDatabase: this.config.database }),
    };
  }
}
