import initWasm from '../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.wasm?init';
import * as bindings from '../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js';
import { __wbg_set_wasm } from '../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js';
import * as inline0 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline0.js';
import * as inline1 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline1.js';
import * as inline2 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline2.js';
import * as inline3 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline3.js';
import * as inline4 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline4.js';
import * as inline5 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline5.js';
import * as inline6 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline6.js';
import * as inline7 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline7.js';
import * as inline8 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline8.js';
import * as inline9 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline9.js';
import * as inline11 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline11.js';
import * as inline13 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline13.js';
import * as inline17 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline17.js';
import * as inline18 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline18.js';
import * as inline19 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline19.js';
import * as inline20 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline20.js';
import * as inline21 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline21.js';
import * as inline22 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline22.js';
import * as inline23 from '../../../node_modules/@midnight-ntwrk/ledger-v8/snippets/midnight-ledger-wasm-9f71df61dc0427fb/inline23.js';

// Vite dev serves direct WASM imports as async ESM. The generated wrapper calls
// __wbindgen_start through a cycle before that async module is initialized, so
// initialize the same committed artifact explicitly after its imports are ready.
const snippetRoot = './snippets/midnight-ledger-wasm-9f71df61dc0427fb';
const wasmImports = {
  './midnight_ledger_wasm_bg.js': bindings,
  [`${snippetRoot}/inline0.js`]: inline0,
  [`${snippetRoot}/inline1.js`]: inline1,
  [`${snippetRoot}/inline2.js`]: inline2,
  [`${snippetRoot}/inline3.js`]: inline3,
  [`${snippetRoot}/inline4.js`]: inline4,
  [`${snippetRoot}/inline5.js`]: inline5,
  [`${snippetRoot}/inline6.js`]: inline6,
  [`${snippetRoot}/inline7.js`]: inline7,
  [`${snippetRoot}/inline8.js`]: inline8,
  [`${snippetRoot}/inline9.js`]: inline9,
  [`${snippetRoot}/inline11.js`]: inline11,
  [`${snippetRoot}/inline13.js`]: inline13,
  [`${snippetRoot}/inline17.js`]: inline17,
  [`${snippetRoot}/inline18.js`]: inline18,
  [`${snippetRoot}/inline19.js`]: inline19,
  [`${snippetRoot}/inline20.js`]: inline20,
  [`${snippetRoot}/inline21.js`]: inline21,
  [`${snippetRoot}/inline22.js`]: inline22,
  [`${snippetRoot}/inline23.js`]: inline23,
};

const instance = await initWasm(wasmImports);
__wbg_set_wasm(instance.exports);
instance.exports.__wbindgen_start();

export * from '../../../node_modules/@midnight-ntwrk/ledger-v8/midnight_ledger_wasm_bg.js';
