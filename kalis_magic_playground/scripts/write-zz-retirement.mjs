import { ZZ_RETIREMENT_SPECS, retirementWorkerSource } from './zz-retirement.mjs';

export async function writeZzRetirementWorkers(distRoot) {
  const { mkdir, writeFile } = await import('node:fs/promises');
  const { join } = await import('node:path');
  for (const spec of ZZ_RETIREMENT_SPECS) {
    const directory = join(distRoot, 'legacy-bridges', spec.id);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'sw.js'), retirementWorkerSource(spec));
  }
  await writeFile(join(distRoot, 'zz-retired.html'), '<!doctype html><html lang="ko"><meta charset="utf-8"><title>찾을 수 없음</title><p>요청한 페이지를 찾을 수 없습니다.</p></html>');
}
