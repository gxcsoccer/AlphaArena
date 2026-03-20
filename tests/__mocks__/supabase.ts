// Mock for Supabase client
// This provides a mock implementation for database tests

// Store mock data globally for tests to access and modify
const mockDataStore: Map<string, any[]> = new Map();

// Helper to get or create data for a table
function getTableData(table: string): any[] {
  if (!mockDataStore.has(table)) {
    mockDataStore.set(table, []);
  }
  return mockDataStore.get(table)!;
}

interface MockQueryBuilder {
  select: jest.MockedFunction<(columns?: string) => MockQueryBuilder>;
  insert: jest.MockedFunction<(rows: any[]) => MockQueryBuilder>;
  update: jest.MockedFunction<(updates: any) => MockQueryBuilder>;
  delete: jest.MockedFunction<() => MockQueryBuilder>;
  eq: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  neq: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  gt: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  gte: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  lt: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  lte: jest.MockedFunction<(column: string, value: any) => MockQueryBuilder>;
  in: jest.MockedFunction<(column: string, values: any[]) => MockQueryBuilder>;
  order: jest.MockedFunction<(column: string, options?: any) => MockQueryBuilder>;
  limit: jest.MockedFunction<(count: number) => MockQueryBuilder>;
  offset: jest.MockedFunction<(count: number) => MockQueryBuilder>;
  range: jest.MockedFunction<(start: number, end: number) => MockQueryBuilder>;
  single: jest.MockedFunction<() => Promise<any>>;
  maybeSingle: jest.MockedFunction<() => Promise<any>>;
  rpc: jest.MockedFunction<(fn: string, params?: any) => Promise<any>>;
  // Make it thenable so it can be awaited
  then: jest.MockedFunction<(resolve: any, reject?: any) => any>;
}

function createMockQueryBuilder(tableName?: string): MockQueryBuilder {
  // Track what operation we're doing
  let operation: 'select' | 'insert' | 'update' | 'delete' | null = null;
  let insertPayload: any[] = [];
  let updatePayload: any = null;
let _selectColumns = '*';
  let isSingle = false;
  let _wantSelectAfterMutation = false; // For insert().select() or update().select()
  
  // Track filters applied
  const filters: Array<{ type: string; column: string; value: any }> = [];
  let orderConfig: { column: string; ascending: boolean } | null = null;
  let limitCount: number | null = null;
  let offsetCount: number | null = null;

  const builder: any = {};

  // Helper to get fresh data and apply filters
  function getFilteredData(): any[] {
    // Get fresh data from the store each time
    let data = tableName ? [...getTableData(tableName)] : [];
    
    // Apply filters
    for (const filter of filters) {
      switch (filter.type) {
        case 'eq':
          data = data.filter(item => item[filter.column] === filter.value);
          break;
        case 'neq':
          data = data.filter(item => item[filter.column] !== filter.value);
          break;
        case 'gt':
          data = data.filter(item => item[filter.column] > filter.value);
          break;
        case 'gte':
          data = data.filter(item => item[filter.column] >= filter.value);
          break;
        case 'lt':
          data = data.filter(item => item[filter.column] < filter.value);
          break;
        case 'lte':
          data = data.filter(item => item[filter.column] <= filter.value);
          break;
        case 'in':
          data = data.filter(item => filter.value.includes(item[filter.column]));
          break;
      }
    }
    
    // Apply ordering
    if (orderConfig) {
      data.sort((a, b) => {
        const aVal = a[orderConfig.column];
        const bVal = b[orderConfig.column];
        if (aVal < bVal) return orderConfig.ascending ? -1 : 1;
        if (aVal > bVal) return orderConfig.ascending ? 1 : -1;
        return 0;
      });
    }
    
    // Apply offset
    if (offsetCount !== null) {
      data = data.slice(offsetCount);
    }
    
    // Apply limit
    if (limitCount !== null) {
      data = data.slice(0, limitCount);
    }
    
    return data;
  }

  // Select - returns builder for chaining
  builder.select = jest.fn().mockImplementation((columns?: string) => {
    // If we already have an insert/update operation, this select is to return the data
    if (operation === 'insert' || operation === 'update') {
      _wantSelectAfterMutation = true;
    } else {
      operation = 'select';
    }
    if (columns) _selectColumns = columns;
    return builder;
  });

  // Insert - returns builder for chaining
  builder.insert = jest.fn().mockImplementation((rows: any[]) => {
    operation = 'insert';
    // Support both array and single object
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    insertPayload = rowsArray.map((row, i) => ({
      id: row.id || `mock-id-${Date.now()}-${i}`,
      ...row,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    }));
    // Add to mock data store
    if (tableName) {
      const tableData = getTableData(tableName);
      tableData.push(...insertPayload);
      // DEBUG
      // console.log(`[Mock ${tableName}] insert: ${insertPayload.length} records, total now: ${tableData.length}`);
    }
    return builder;
  });

  // Upsert - returns builder for chaining (insert or update if exists)
  builder.upsert = jest.fn().mockImplementation((rows: any[]) => {
    operation = 'insert'; // Treat as insert for simplicity
    // Support both array and single object
    const rowsArray = Array.isArray(rows) ? rows : [rows];
    insertPayload = rowsArray.map((row, i) => ({
      id: row.id || `mock-id-${Date.now()}-${i}`,
      ...row,
      created_at: row.created_at || new Date().toISOString(),
      updated_at: row.updated_at || new Date().toISOString(),
    }));
    // Add to mock data store, updating if id matches
    if (tableName) {
      const tableData = getTableData(tableName);
      insertPayload.forEach(newRow => {
        const existingIndex = tableData.findIndex(r => r.id === newRow.id);
        if (existingIndex >= 0) {
          tableData[existingIndex] = { ...tableData[existingIndex], ...newRow };
        } else {
          tableData.push(newRow);
        }
      });
    }
    return builder;
  });

  // Update - returns builder for chaining
  builder.update = jest.fn().mockImplementation((updates: any) => {
    operation = 'update';
    // Support both array and single object
    const updateData = Array.isArray(updates) ? updates[0] : updates;
    updatePayload = { ...updateData };
    return builder;
  });

  // Delete - returns builder for chaining
  builder.delete = jest.fn().mockImplementation(() => {
    operation = 'delete';
    return builder;
  });

  // Filter methods - store filters for later application
  builder.eq = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'eq', column, value });
    return builder;
  });

  builder.neq = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'neq', column, value });
    return builder;
  });

  builder.gt = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'gt', column, value });
    return builder;
  });

  builder.gte = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'gte', column, value });
    return builder;
  });

  builder.lt = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'lt', column, value });
    return builder;
  });

  builder.lte = jest.fn().mockImplementation((column: string, value: any) => {
    filters.push({ type: 'lte', column, value });
    return builder;
  });

  builder.in = jest.fn().mockImplementation((column: string, values: any[]) => {
    filters.push({ type: 'in', column, value: values });
    return builder;
  });

  builder.order = jest.fn().mockImplementation((column: string, options?: any) => {
    orderConfig = { column, ascending: options?.ascending !== false };
    return builder;
  });

  builder.limit = jest.fn().mockImplementation((count: number) => {
    limitCount = count;
    return builder;
  });

  builder.offset = jest.fn().mockImplementation((count: number) => {
    offsetCount = count;
    return builder;
  });

  builder.range = jest.fn().mockImplementation((start: number, end: number) => {
    offsetCount = start;
    limitCount = end - start + 1;
    return builder;
  });

  // single/maybeSingle - these resolve immediately
  builder.single = jest.fn().mockImplementation(() => {
    isSingle = true;
    return executeOperation();
  });

  builder.maybeSingle = jest.fn().mockImplementation(() => {
    isSingle = true;
    return executeOperation();
  });

  builder.rpc = jest.fn().mockImplementation((_fn: string, _params?: any) => {
    return Promise.resolve({ data: null, error: null });
  });

  // Helper to execute the operation and return result
  function executeOperation(): Promise<any> {
    if (operation === 'insert') {
      // For insert, we just return the inserted data
      if (isSingle) {
        return Promise.resolve({ data: insertPayload[0] || null, error: null });
      }
      return Promise.resolve({ data: insertPayload, error: null, count: insertPayload.length });
    }
    
    if (operation === 'update') {
      // Get filtered data and update it in the store
      const filteredData = getFilteredData();
      
      if (tableName && updatePayload) {
        const tableData = getTableData(tableName);
        filteredData.forEach(item => {
          const idx = tableData.findIndex(d => d.id === item.id);
          if (idx >= 0) {
            // Merge update payload with existing record
            tableData[idx] = { ...tableData[idx], ...updatePayload };
          }
        });
        // Return the updated records
        const updatedRecords = filteredData.map(item => ({
          ...item,
          ...updatePayload
        }));
        if (isSingle) {
          return Promise.resolve({ data: updatedRecords[0] || null, error: null });
        }
        return Promise.resolve({ data: updatedRecords, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }
    
    if (operation === 'delete') {
      // Get filtered data and delete it from the store
      const filteredData = getFilteredData();
      
      if (tableName) {
        const tableData = getTableData(tableName);
        const idsToDelete = filteredData.map(item => item.id);
        const newData = tableData.filter(item => !idsToDelete.includes(item.id));
        mockDataStore.set(tableName, newData);
      }
      return Promise.resolve({ data: null, error: null });
    }
    
    if (operation === 'select') {
      const filteredData = getFilteredData();
      if (isSingle) {
        return Promise.resolve({ data: filteredData[0] || null, error: null });
      }
      return Promise.resolve({ data: filteredData, error: null, count: filteredData.length });
    }
    
    // Default
    return Promise.resolve({ data: null, error: null });
  }

  // Make the builder thenable - this allows it to be awaited
  builder.then = jest.fn().mockImplementation((resolve: any, reject?: any) => {
    return executeOperation().then(resolve, reject);
  });

  return builder;
}

const mockSupabaseClient = {
  from: jest.fn().mockImplementation((table: string) => createMockQueryBuilder(table)),
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

// Clear Supabase mock data between tests
export function clearMockData() {
  // DEBUG
  // console.log('[Mock] clearMockData called');
  mockDataStore.clear();
}

// Export helper to seed mock data
export function seedMockData(table: string, data: any[]) {
  mockDataStore.set(table, [...data]);
}

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