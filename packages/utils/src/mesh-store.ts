export type MeshStore<TKey = string> = {
  child(identifier: TKey): MeshStore;
  has(id: TKey): Promise<boolean>;
  get<TData>(id: TKey): Promise<TData>;
  path(id: TKey): string;
  set<TData>(id: TKey, data: TData): Promise<void>;
};

export class InMemoryMeshStore implements MeshStore {
  protected data = new Map<string, string>();

  child(identifier: string): MeshStore<string> {
    throw new Error('Method not implemented.');
  }

  async has(id: string): Promise<boolean> {
    return this.data.has(id);
  }

  async get<TData>(id: string): Promise<TData> {
    return (this.data.get(id) as any) as TData;
  }

  path(id: string): string {
    throw new Error('Method not implemented.');
  }

  set<TData>(id: string, data: TData): Promise<void> {
    throw new Error('Method not implemented.');
  }
}

export class FsMeshStore implements MeshStore {
  child(identifier: string): MeshStore<string> {
    throw new Error('Method not implemented.');
  }

  has(id: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }

  get<TData>(id: string): Promise<TData> {
    throw new Error('Method not implemented.');
  }

  path(id: string): string {
    throw new Error('Method not implemented.');
  }

  set<TData>(id: string, data: TData): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
