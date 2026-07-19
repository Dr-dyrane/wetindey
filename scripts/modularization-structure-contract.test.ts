import assert from "node:assert/strict";
import { readdirSync, existsSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = resolve(root, "src/app/_components");

test("modular component subfolders adhere to the 6-file MVC slice contract", () => {
  if (!existsSync(componentsDir)) {
    assert.fail("src/app/_components directory missing");
  }

  const entries = readdirSync(componentsDir);
  const subfolders = entries.filter((entry) => {
    const fullPath = resolve(componentsDir, entry);
    return statSync(fullPath).isDirectory();
  });

  assert.ok(subfolders.length > 0, "expected modularized subfolders under src/app/_components");

  for (const folder of subfolders) {
    const folderPath = resolve(componentsDir, folder);
    const subEntries = readdirSync(folderPath);

    // Verify sub-directories exist: hooks, views, styles, copy, imports
    const requiredSubdirs = ["hooks", "views", "styles", "copy", "imports"];
    for (const subdir of requiredSubdirs) {
      const subdirPath = resolve(folderPath, subdir);
      assert.ok(
        existsSync(subdirPath) && statSync(subdirPath).isDirectory(),
        `Modularized component '${folder}' is missing required subdirectory '${subdir}/'`
      );
    }

    // Verify files within sub-directories
    const hooksFiles = readdirSync(resolve(folderPath, "hooks"));
    assert.ok(
      hooksFiles.some((f) => /^use.+\.ts$/.test(f)),
      `Modularized component '${folder}' hooks/ directory must contain a use<Component>.ts hook`
    );

    const viewsFiles = readdirSync(resolve(folderPath, "views"));
    assert.ok(
      viewsFiles.some((f) => /.View\.tsx$/.test(f)),
      `Modularized component '${folder}' views/ directory must contain a <Component>View.tsx view`
    );

    const stylesFiles = readdirSync(resolve(folderPath, "styles"));
    assert.ok(
      stylesFiles.some((f) => /\.css$/.test(f)),
      `Modularized component '${folder}' styles/ directory must contain a scoped CSS stylesheet`
    );

    const copyFiles = readdirSync(resolve(folderPath, "copy"));
    assert.ok(
      copyFiles.includes("copy.ts"),
      `Modularized component '${folder}' copy/ directory must contain copy.ts`
    );

    const importsFiles = readdirSync(resolve(folderPath, "imports"));
    assert.ok(
      importsFiles.includes("imports.ts"),
      `Modularized component '${folder}' imports/ directory must contain imports.ts`
    );
  }
});
