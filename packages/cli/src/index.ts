import { findAndParseConfig } from '@graphql-mesh/config';
import { getMesh } from '@graphql-mesh/runtime';
import * as yargs from 'yargs';
import { generateTsArtifacts } from './commands/ts-artifacts';
import { serveMesh } from './commands/serve/serve';
import { isAbsolute, resolve, join } from 'path';
import { existsSync } from 'fs';
import { logger } from './logger';
import { FsStoreStorageAdapter, MeshStore } from '@graphql-mesh/store';
import { dumpSchema } from './commands/dump-schema';

export { generateTsArtifacts, serveMesh };

export async function graphqlMesh() {
  let baseDir = process.cwd();

  return yargs
    .help()
    .option('r', {
      alias: 'require',
      describe: 'Loads specific require.extensions before running the codegen and reading the configuration',
      type: 'array' as const,
      default: [],
      coerce: (externalModules: string[]) =>
        Promise.all(
          externalModules.map(module => {
            const localModulePath = resolve(process.cwd(), module);
            const islocalModule = existsSync(localModulePath);
            return import(islocalModule ? localModulePath : module);
          })
        ),
    })
    .option('dir', {
      describe: 'Modified the base directory to use for looking for meshrc config file',
      type: 'string',
      default: process.cwd(),
      coerce: dir => {
        if (isAbsolute(dir)) {
          baseDir = dir;
        } else {
          baseDir = resolve(process.cwd(), dir);
        }
      },
    })
    .command<{ port: number; prod: boolean; validate: boolean }>(
      'serve',
      'Serves a GraphQL server with GraphQL interface to test your Mesh API',
      builder => {
        builder.option('port', {
          type: 'number',
        });
        builder.option('prod', {
          type: 'boolean',
          coerce: value => value || process.env.NODE_ENV?.toLowerCase() === 'production',
        });
      },
      async args => {
        try {
          await serveMesh({
            baseDir,
            argsPort: args.port,
            store: new MeshStore(join(baseDir, '.mesh'), new FsStoreStorageAdapter(), {
              readonly: args.prod,
              validate: false,
            }),
          });
        } catch (e) {
          logger.error('Unable to serve mesh: ', e);
        }
      }
    )
    .command<{ output: string }>(
      'build',
      'Builds artifacts',
      builder => {},
      async args => {
        const meshConfig = await findAndParseConfig({
          dir: baseDir,
          ignoreAdditionalResolvers: true,
          store: new MeshStore(join(baseDir, '.mesh'), new FsStoreStorageAdapter(), {
            readonly: false,
            validate: false,
          }),
        });
        const { schema, destroy, rawSources } = await getMesh(meshConfig);
        await Promise.all([
          generateTsArtifacts(schema, rawSources, meshConfig.mergerType, meshConfig.documents, baseDir, false),
          dumpSchema(schema, baseDir),
        ]);
        destroy();
      }
    ).argv;
}
