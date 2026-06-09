// diag 2: test parser
const { parseDslOutput } = require('./packages/core/dist/dsl/parser');

const raw = '>compile(path=assets/llll.prefab); >node(R1, name=llll); >comp(R1, cc.UITransform, width=100, height=100); >write(path=assets/llll.prefab); >done()';

console.log('=== Input ===');
console.log(raw);
console.log('=== Parsed ===');
const parsed = parseDslOutput(raw);
console.log('done:', parsed.done);
console.log('commands:', JSON.stringify(parsed.commands.map(c => ({type: c.type, path: c.path, spec: c.spec ? {path: c.spec.path, nodeCount: c.spec.nodes.length} : undefined})), null, 2));
console.log('rawNotes:', parsed.rawNotes);
