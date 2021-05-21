import { promises as fsPromises } from 'fs';
import { join } from 'path';
import { pathExists, writeFile, flatString, jsonFlatStringify } from '@graphql-mesh/utils';
import { Source, buildSchema } from 'graphql';
import { Change, CriticalityLevel, diff } from '@graphql-inspector/core';
import AggregateError from '@ardatan/aggregate-error';
import { printSchemaWithDirectives } from '@graphql-tools/utils';

const { readFile } = fsPromises;

export class ReadonlyStoreError extends Error {}

export class ValidationError extends Error {
  constructor(message: string, public originalError: Error) {
    super(message);
  }
}

export type StoreStorageAdapter<TData = any, TKey = string> = {
  exists: (key: TKey) => Promise<boolean>;
  read: (key: TKey, options: ProxyOptions<TData>) => Promise<TData>;
  write: (key: TKey, data: TData, options: ProxyOptions<TData>) => Promise<TData>;
};

export class InMemoryStoreStorageAdapter implements StoreStorageAdapter {
  private data = new Map<string, any>();

  async exists(key: string): Promise<boolean> {
    return this.data.has(key);
  }

  async read<TData>(key: string, options: ProxyOptions<any>): Promise<TData> {
    return this.data.get(key);
  }

  async write<TData>(key: string, data: TData, options: ProxyOptions<any>): Promise<void> {
    this.data.set(key, data);
  }

  clear() {
    this.data.clear();
  }
}

export class FsStoreStorageAdapter implements StoreStorageAdapter {
  async exists(key: string): Promise<boolean> {
    return pathExists(key);
  }

  async read<TData>(key: string, options: ProxyOptions<any>): Promise<TData> {
    const asString = await readFile(key, 'utf-8');

    return options.parse(asString);
  }

  async write<TData>(key: string, data: TData, options: ProxyOptions<any>): Promise<void> {
    const asString = options.serialize(data);
    return writeFile(key, asString);
  }
}

export type StoreProxy<TData> = {
  set(value: TData): Promise<void>;
  get(): Promise<TData>;
};

export type ProxyOptions<TData> = {
  parse: (content: string) => TData;
  serialize: (value: TData) => string;
  validate: (oldValue: TData, newValue: TData) => void | Promise<void>;
};

export type StoreFlags = {
  readonly: boolean;
  validate: boolean;
};

export enum PredefinedProxyOptionsName {
  JsonWithoutValidation = 'JsonWithoutValidation',
  StringWithoutValidation = 'StringWithoutValidation',
  GraphQLSchemaWithDiffing = 'GraphQLSchemaWithDiffing',
}

export const PredefinedProxyOptions: Record<PredefinedProxyOptionsName, ProxyOptions<any>> = {
  JsonWithoutValidation: {
    parse: v => JSON.parse(v),
    serialize: v => jsonFlatStringify(v),
    validate: () => null,
  },
  StringWithoutValidation: {
    parse: v => flatString(v),
    serialize: v => flatString(v),
    validate: () => null,
  },
  GraphQLSchemaWithDiffing: {
    parse: schemaStr =>
      buildSchema(new Source(schemaStr, 'schema.graphql'), {
        assumeValid: true,
        assumeValidSDL: true,
      }),
    serialize: schema => printSchemaWithDirectives(schema),
    validate: (oldSchema, newSchema) => {
      const changes: Change[] = diff(oldSchema, newSchema);
      const errors: string[] = [];
      for (const change of changes) {
        if (
          change.criticality.level === CriticalityLevel.Breaking ||
          change.criticality.level === CriticalityLevel.Dangerous
        ) {
          errors.push(change.message);
        }
      }
      if (errors.length) {
        throw new AggregateError(errors);
      }
    },
  },
};

export class MeshStore {
  constructor(public identifier: string, protected storage: StoreStorageAdapter, public flags: StoreFlags) {}

  child(childIdentifier: string): MeshStore {
    return new MeshStore(join(this.identifier, childIdentifier), this.storage, this.flags);
  }

  proxy<TData>(id: string, options: ProxyOptions<TData>): StoreProxy<TData> {
    const path = join(this.identifier, id);
    let value: TData | null | undefined;

    return {
      get: async () => {
        if (typeof value !== 'undefined') {
          return value;
        }

        if (!(await this.storage.exists(path))) {
          return undefined;
        }

        return this.storage.read(path, options);
      },
      set: async newValue => {
        if (this.flags.readonly) {
          throw new ReadonlyStoreError(
            `Unable to set value for "${id}" under "${this.identifier}" because the store is in read-only mode.`
          );
        }

        if (this.flags.validate) {
          if (value && newValue) {
            try {
              await options.validate(value, newValue);
            } catch (e) {
              throw new ValidationError(`Validation failed for "${id}" under "${this.identifier}"!`, e);
            }
          }
        }

        value = newValue;
        await this.storage.write(path, value, options);
      },
    };
  }
}
