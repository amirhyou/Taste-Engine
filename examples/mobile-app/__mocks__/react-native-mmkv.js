const store = new Map();
const MMKV = jest.fn().mockImplementation(() => ({
  getString: jest.fn((key) => store.get(key) ?? undefined),
  set: jest.fn((key, value) => store.set(key, value)),
  delete: jest.fn((key) => store.delete(key)),
}));
module.exports = { MMKV };
