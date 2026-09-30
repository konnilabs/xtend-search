import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const sdk=path.resolve(path.dirname(require.resolve('@ccslabs/xtend/rmt/node-ssr-adapter')),'..');
// Supply static contracts explicitly; no browser component code runs in Node.
const manifest=JSON.parse(fs.readFileSync(path.join(sdk,'components/manifest.json'),'utf8'));
export const ssrCapabilities={manifest,sourceTexts:Object.fromEntries(Object.entries(manifest).map(([tag,module])=>[tag,fs.readFileSync(path.join(sdk,'components',module),'utf8')]))};
