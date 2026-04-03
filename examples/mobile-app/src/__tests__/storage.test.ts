import { StorageService } from '../services/storage';

describe('StorageService.getJSON', () => {
  it('returns null for missing key', () => {
    expect(StorageService.getJSON('nonexistent')).toBeNull();
  });

  it('returns parsed object for valid JSON', () => {
    StorageService.setJSON('test_key', { foo: 1 });
    expect(StorageService.getJSON('test_key')).toEqual({ foo: 1 });
  });

  it('returns null and does not throw for malformed JSON', () => {
    // Directly set a corrupt string bypassing setJSON
    StorageService.set('bad_key', '{not valid json}');
    expect(StorageService.getJSON('bad_key')).toBeNull();
  });
});
