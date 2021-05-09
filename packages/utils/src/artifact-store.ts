export type ArtifactStore<TKey = string> = {
  child(identifier: TKey): ArtifactStore;
  has(id: TKey): Promise<boolean>;
  get<TData>(id: TKey): Promise<TData>;
  path(id: TKey): string;
  set<TData>(id: TKey, data: TData): Promise<void>;
};

export class FsArtifactStore implements ArtifactStore<string> {
  child(identifier: string): ArtifactStore<string> {
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
