// Mock for uuid module
export const v4 = jest.fn(() => 'mock-uuid-1234-5678-90ab-cdef');
export const v5 = jest.fn(() => 'mock-uuid-v5-1234-5678');
export const MAX = 9007199254740991;
export default { v4, v5, MAX };
