import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// 2026-11-12 personal-only round: visible wake locks, extracted feature modules,
// silent spinner status, and remembered Pi Max install dismissal.
// Both sides are pinned: exceptions cannot hide future changes to either runtime.
const differences = {
  "zz4/wake-lock.js": {
    "snapshot": "distribution-snapshots/choice/wake-lock.js",
    "sha256": [
      "d0896b84786a37fda0b2e0cefa15aad0b426bce51f5371854d9bee8c53f24bfb",
      "13829ff4bceef9efb95520b2aee265b4cfd12cadf1067ca12d0015d73bc493dd"
    ]
  },
  "zz4/sw.js": {
    "snapshot": "distribution-snapshots/choice/sw.js",
    "sha256": [
      "aea63f8be600fdb20d1d0b909e984b90d177bdf74975dd88063751b03806f8b3",
      "9408f4e4ea6defbd2a8f4780cdabd363d07a1daaafba66df032087acc30f34e3"
    ]
  },
  "zz2/rewind.js": {
    "snapshot": "distribution-snapshots/unlock/rewind.js",
    "sha256": [
      "5b65e2479ae97d23e05c99bb45d3d826b89a039ab7853a7120d603b100bac33f",
      "3c636e70d6a13061e4734e34444cf469ef8d66846a9d2f6332ed59fa12d8d2a0"
    ]
  },
  "zz2/sw.js": {
    "snapshot": "distribution-snapshots/unlock/sw.js",
    "sha256": [
      "9be71ff0760848e0ee9f558fdac1d289c3a2bb11af9fd7256d98175f22b2e7f4",
      "c997ac00aaaf402bc5ecfa791115f2b81fb8d4f80e8f9479aafc76825d0a6a10"
    ]
  },
  "zz7/wake-lock.js": {
    "snapshot": "distribution-snapshots/usotsuki/wake-lock.js",
    "sha256": [
      "d0896b84786a37fda0b2e0cefa15aad0b426bce51f5371854d9bee8c53f24bfb",
      "c0dd12b6d17af92777f4796a163a42f22da9d7bc8ed172367aa783e1f84d5b70"
    ]
  },
  "zz7/sw.js": {
    "snapshot": "distribution-snapshots/usotsuki/sw.js",
    "sha256": [
      "1b5442b94398fbf24d42478f7f3aff939f4ea598104e44a5345730bd1af512e1",
      "c4c3ac018de11e60378d0c7e9e387bc55b1d9ea81bd1279d894cc5b342fe62b0"
    ]
  },
  "zz11/app.js": {
    "snapshot": "distribution-snapshots/spinner/app.js",
    "sha256": [
      "13f44428eb825db6307be3a1cfeec6eea43b3897eb6850f33923fed43af33220",
      "600e58565dc85c23f18bfd052ae2cec8cf009f3cd315e6631b4524f1cf2ff319"
    ]
  },
  "zz11/style-casino.css": {
    "snapshot": "distribution-snapshots/spinner/style-casino.css",
    "sha256": [
      "e5ac13729161d84a85eb4580d2895ee8e7425dee33eda50b986aba9287b0255a",
      "18a1413722be82848dead7e515fad1de4b5e1ef6e1816f91ac76f3b45aae273b"
    ]
  },
  "zz12/app.mjs": {
    "snapshot": "distribution-snapshots/memdeck/app.mjs",
    "sha256": [
      "0532d28c0cace1842784593eccb14a4ca79c5ae80d54f47b84fe418a44b86af6",
      "c79adb527684e72b88d9e5a635b59ad17a7f5919883a18229db4005ce4c809e8"
    ]
  },
  "zz12/sw.js": {
    "snapshot": "distribution-snapshots/memdeck/sw.js",
    "sha256": [
      "eb35b1e4414eb60e89c05e633679e95e6b42d4e4ec2b9be75a95515e0321647c",
      "b09aff9bfac0c236fcaf782f1702ac49c65199ab145adc27ada3eecd999635ee"
    ]
  },
  "zz14/app.mjs": {
    "snapshot": "distribution-snapshots/pimax/app.mjs",
    "sha256": [
      "971c39ace3eb289af3bc1da30184cc8f4d39dcabe116807abfa0601245ce1ff8",
      "910513355af1987d6cc1f8218974ac077859fd7cb586e556c69b34b862bd2451"
    ]
  },
  "zz14/install.mjs": {
    "snapshot": "distribution-snapshots/pimax/install.mjs",
    "sha256": [
      "759d5c20fb473d545348151aa32e7f50dc03847b67919fa590a1d5bb0dc04b60",
      "8179bdb86017a3f6cf71d3be06b1d605ec7ecb256ac9751b1048b49f594ec49a"
    ]
  },
  "zz14/sw.js": {
    "snapshot": "distribution-snapshots/pimax/sw.js",
    "sha256": [
      "d387fb4841bd56f1e2e191e9d82be2b07e389bca7ebcc8ac3324eb9508b3e265",
      "70979c526f286c49c179a6310b0dd155be260abaac6280e26c5ad8e57f61aa05"
    ]
  }
};

export function pinnedRound5Difference(route, file) {
  const key = `${route}/${file}`;
  const entry = differences[key];
  if (!entry) return false;
  for (const [i, path] of [key, entry.snapshot].entries()) {
    const bytes = readFileSync(new URL(`../../${path}`, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256[i], path);
  }
  return true;
}

export const MEMDECK_PERSONAL_MODULES = ['storage.mjs', 'screen-shared.mjs', 'study.mjs', 'quiz.mjs', 'table.mjs', 'records.mjs', 'settings.mjs', 'rank.mjs', 'memory-model.mjs', 'memory-training.mjs', 'memory.mjs'];
