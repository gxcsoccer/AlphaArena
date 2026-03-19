// Mock for Supabase client
// This provides a mock implementation for database tests

type MockQueryBuilder = {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  delete: jest.Mock;
  eq: jest.Mock;
  neq: jest.Mock;
  gt: jest.Mock;
  gte: jest.Mock;
  lt: jest.Mock;
  lte: jest.Mock;
  in: jest.Mock;
  order: jest.Mock;
  limit: jest.Mock;
  offset: jest.Mock;
  range: jest.Mock;
  single: jest.Mock;
  maybeSingle: jest.Mock;
  rpc: jest.Mock;
};

function createMockQueryBuilder(): MockQueryBuilder {
  const builder: any = {
    _data: [] as any[],
    _filters: [] as any[],
    _single: false,
  };

  // Chainable methods that return the builder
  builder.select = jest.fn().mockImplementation((columns?: string) => {
    return Promise.resolve({ data: builder._data, error: null, count: builder._data.length });
  });

  builder.insert = jest.fn().mockImplementation((rows: any[]) => {
    const inserted = rows.map((row, i) => ({ id: `mock-id-${Date.now()}-${i}`, ...row }));
    builder._data = inserted;
    return Promise.resolve({ data: inserted[0], error: null });
  });

  builder.update = jest.fn().mockImplementation((updates: any) => {
    const updated = builder._data.map(item => ({ ...item, ...updates }));
    return Promise.resolve({ data: updated[0], error: null });
  });

  builder.delete = jest.fn().mockImplementation(() => {
    return Promise.resolve({ data: null, error: null });
  });

  // Filter methods - chainable
  builder.eq = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] === value);
    return builder;
  });

  builder.neq = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] !== value);
    return builder;
  });

  builder.gt = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] > value);
    return builder;
  });

  builder.gte = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] >= value);
    return builder;
  });

  builder.lt = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] < value);
    return builder;
  });

  builder.lte = jest.fn().mockImplementation((column: string, value: any) => {
    builder._data = builder._data.filter(item => item[column] <= value);
    return builder;
  });

  builder.in = jest.fn().mockImplementation((column: string, values: any[]) => {
    builder._data = builder._data.filter(item => values.includes(item[column]));
    return builder;
  });

  builder.order = jest.fn().mockImplementation((column: string, options?: any) => {
    return builder;
  });

  builder.limit = jest.fn().mockImplementation((count: number) => {
    builder._data = builder._data.slice(0, count);
    return builder;
  });

  builder.offset = jest.fn().mockImplementation((count: number) => {
    builder._data = builder._data.slice(count);
    return builder;
  });

  builder.range = jest.fn().mockImplementation((start: number, end: number) => {
    builder._data = builder._data.slice(start, end + 1);
    return builder;
  });

  builder.single = jest.fn().mockImplementation(() => {
    return Promise.resolve({ data: builder._data[0] || null, error: null });
  });

  builder.maybeSingle = jest.fn().mockImplementation(() => {
    return Promise.resolve({ data: builder._data[0] || null, error: null });
  });

  builder.rpc = jest.fn().mockImplementation((fn: string, params?: any) => {
    return Promise.resolve({ data: null, error: null });
  });

  return builder;
}

const mockSupabaseClient = {
  from: jest.fn().mockImplementation((table: string) => createMockQueryBuilder()),
  auth: {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null, session: null }, error: null }),
    signOut: jest.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: jest.fn().mockImplementation(() => ({
      data: { subscription: { unsubscribe: jest.fn() } },
    })),
  },
  storage: {
    from: jest.fn().mockImplementation(() => ({
      upload: jest.fn().mockResolvedValue({ data: { path: 'test' }, error: null }),
      download: jest.fn().mockResolvedValue({ data: new Blob(), error: null }),
      remove: jest.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://example.com/test' } }),
    })),
  },
  realtime: {
    channel: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn().mockReturnThis(),
      unsubscribe: jest.fn(),
    })),
  },
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

export function getSupabaseClient() {
  return mockSupabaseClient as any;
}

export function getSupabaseAdminClient() {
  return mockSupabaseClient as any;
}

export function createClient() {
  return mockSupabaseClient;
}

export default mockSupabaseClient;