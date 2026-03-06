const createMockTx = () => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
});

export const createMockDB = () => ({
  execute: jest.fn().mockResolvedValue({ rows: [] }),
  transaction: jest.fn(async (fn: any) => {
    const tx = createMockTx();
    await fn(tx);
    return tx;
  }),
  close: jest.fn(),
  loadExtension: jest.fn(),
  updateHook: jest.fn(),
  reactiveExecute: jest.fn(() => jest.fn()),
});

export const open = jest.fn(() => createMockDB());
export const getDylibPath = jest.fn(
  (_bundleId: string, _name: string) => '/mock/path/CloudSync'
);

export type DB = ReturnType<typeof createMockDB>;
export type QueryResult = {
  rows?: Record<string, any>[];
  insertId?: number;
  rowsAffected?: number;
};
export type Transaction = ReturnType<typeof createMockTx>;
