import { expect, it } from 'vitest';
import { Storage } from './storage';
import { fixtureSourceId, fixtureText } from '../../tests/fixtures/legacy-databases';
it('rejects an array-valued reading tone before persisting corrupt data (independent boundary regression)', () => {
  const store = new Storage(':memory:');
  try {
    store.addSource({
      id: fixtureSourceId,
      name: '事务',
      kind: 'markdown',
      bytes: Buffer.byteLength(fixtureText),
      pageCount: 1,
      textStatus: 'ready',
      outline: [],
      segments: [],
    });
    const before = store.getSource(fixtureSourceId)!.position;
    expect(() =>
      store.saveReadingPosition(fixtureSourceId, { ...before, tone: ['paper'] }),
    ).toThrow();
    expect(store.getSource(fixtureSourceId)!.position).toEqual(before);
  } finally {
    store.close();
  }
});
