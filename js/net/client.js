// Client net facade for ESM consumers.
export default globalThis.__gameRegistry && globalThis.__gameRegistry.GameNet
  ? globalThis.__gameRegistry.GameNet
  : {};
