// API layer - re-exports from main source tree
// Core acts as a thin re-export layer to avoid breaking existing CLI imports

export { query } from 'src/query.js';
export type { CanUseToolFn } from 'src/hooks/useCanUseTool.js';
