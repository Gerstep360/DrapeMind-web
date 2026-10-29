import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const output = path.resolve('dist/web/browser');
async function files(folder) {
  return (
    await Promise.all(
      (await fs.readdir(folder, { withFileTypes: true })).map(async (item) =>
        item.isDirectory() ? files(path.join(folder, item.name)) : [path.join(folder, item.name)],
      ),
    )
  ).flat();
}
const paths = (await files(output)).filter(
  (file) => /\.(js|css|woff2?|ico|svg)$/.test(file) && !file.endsWith(`${path.sep}sw.js`),
);
paths.push(
  path.join(output, 'index.html'),
  path.join(output, 'manifest.webmanifest'),
  path.join(output, 'config.json'),
);
paths.sort();
const hash = createHash('sha256');
for (const file of paths) hash.update(path.relative(output, file)).update(await fs.readFile(file));
const revision = hash.digest('hex').slice(0, 20);
await fs.writeFile(
  path.join(output, 'sw-assets.json'),
  JSON.stringify({
    revision,
    assets: paths.map((p) => path.relative(output, p).split(path.sep).join('/')),
  }),
);
const worker = await fs.readFile(path.join(output, 'sw.js'), 'utf8');
await fs.writeFile(
  path.join(output, 'sw.js'),
  worker.replace("const BUILD_ID = 'development';", `const BUILD_ID = '${revision}';`),
);
console.log(
  `PWA preparada: ${paths.length} recursos de la aplicación. Las respuestas de API no se almacenan en el service worker.`,
);
