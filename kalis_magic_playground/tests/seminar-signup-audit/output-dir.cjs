const fs = require('node:fs');
const path = require('node:path');

if (!process.env.SEMINAR_AUDIT_DIR) throw new Error('Set SEMINAR_AUDIT_DIR to an existing directory outside the worktree');
const output = fs.realpathSync(process.env.SEMINAR_AUDIT_DIR);
const root = path.resolve(__dirname, '../../..');
if (output === root || output.startsWith(root + path.sep)) throw new Error('Choose an output directory outside the worktree');
module.exports = output;
