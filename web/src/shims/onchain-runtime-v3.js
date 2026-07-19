import initWasm from '../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.wasm?init';
import * as bindings from '../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js';
import { __wbg_set_wasm } from '../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js';

// Match the ledger development shim: initialize after the generated binding
// module exists, avoiding Vite dev's async ESM/WASM initialization cycle.
const instance = await initWasm({ './midnight_onchain_runtime_wasm_bg.js': bindings });
__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();

export * from '../../../node_modules/@midnight-ntwrk/onchain-runtime-v3/midnight_onchain_runtime_wasm_bg.js';
