import { InMemoryMeshStore } from '../src/mesh-store';

describe('MeshStore', () => {
  describe('InMemoryMeshStore', () => {
    it('has - value exists', async () => {
      const store = new InMemoryMeshStore();
      await store.set('k_1', 'foo');
      expect(await store.has('k_1')).toBeTruthy();
      expect(await store.has('k_2')).toBeFalsy();
    });
  });
});
