import assert from "node:assert/strict";
import { readdirSync, existsSync, readFileSync, statSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const componentsDir = resolve(root, "src/app/_components");

// Narrow, documented exemption for genuine composition hosts.
//
// A folder qualifies ONLY if it is a pure orchestration host: its view
// composes exclusively other _components siblings, it holds no view-state
// hook (its state lives in a shared hook outside the folder), it renders no
// styled leaf DOM (zero className/style), and it carries no local copy.
// Such a component legitimately has no hooks/, styles/, or copy/, so forcing
// those directories would only manufacture empty cargo-cult folders, which is
// exactly what this contract exists to prevent.
//
// Allowlisted folders are still held to imports/ and views/ (and the
// <Component>View.tsx file rule). Everything else keeps all five subdirs.
const ORCHESTRATION_HOSTS = new Set(["presentation-host"]);

// Components whose user copy was hoisted into the central i18n dictionary
// keep no local copy/ directory; the exemption is honest only while the
// component actually reads @/core/i18n, which the contract verifies below.
// The read may live in the view (location-sheet) or in the hook that resolves
// the copy the view renders (confirm-visit-sheet), so both are swept.
const CENTRALIZED_COPY = new Set(["location-sheet", "confirm-visit-sheet", "profile-sheet"]);

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

    // Composition hosts are exempted from hooks/, styles/, and copy/ (see
    // ORCHESTRATION_HOSTS above); real MVC-slice components keep all five.
    const isOrchestrationHost = ORCHESTRATION_HOSTS.has(folder);

    // Verify sub-directories exist: hooks, views, styles, copy, imports
    // (orchestration hosts are held only to views/ and imports/).
    const usesCentralCopy = CENTRALIZED_COPY.has(folder);
    const requiredSubdirs = isOrchestrationHost
      ? ["views", "imports"]
      : usesCentralCopy
        ? ["hooks", "views", "styles", "imports"]
        : ["hooks", "views", "styles", "copy", "imports"];
    if (usesCentralCopy) {
      assert.ok(
        !existsSync(resolve(folderPath, "copy")),
        `'${folder}' claims centralized copy but still has a local copy/ directory`,
      );
      const copyReaderSources = ["views", "hooks"]
        .filter((dir) => existsSync(resolve(folderPath, dir)))
        .flatMap((dir) =>
          readdirSync(resolve(folderPath, dir))
            .filter((name) => name.endsWith(".tsx") || name.endsWith(".ts"))
            .map((name) => readFileSync(resolve(folderPath, dir, name), "utf8")),
        )
        .join("\n");
      assert.match(
        copyReaderSources,
        /@\/core\/i18n/,
        `'${folder}' claims centralized copy but neither its views nor its hooks read @/core/i18n`,
      );
    }
    for (const subdir of requiredSubdirs) {
      const subdirPath = resolve(folderPath, subdir);
      assert.ok(
        existsSync(subdirPath) && statSync(subdirPath).isDirectory(),
        `Modularized component '${folder}' is missing required subdirectory '${subdir}/'`
      );
    }

    // Verify files within sub-directories
    if (!isOrchestrationHost) {
      const hooksFiles = readdirSync(resolve(folderPath, "hooks"));
      assert.ok(
        hooksFiles.some((f) => /^use.+\.ts$/.test(f)),
        `Modularized component '${folder}' hooks/ directory must contain a use<Component>.ts hook`
      );
    }

    const viewsFiles = readdirSync(resolve(folderPath, "views"));
    assert.ok(
      viewsFiles.some((f) => /.View\.tsx$/.test(f)),
      `Modularized component '${folder}' views/ directory must contain a <Component>View.tsx view`
    );

    if (!isOrchestrationHost) {
      const stylesFiles = readdirSync(resolve(folderPath, "styles"));
      assert.ok(
        stylesFiles.some((f) => /\.css$/.test(f)),
        `Modularized component '${folder}' styles/ directory must contain a scoped CSS stylesheet`
      );

      if (!usesCentralCopy) {
        const copyFiles = readdirSync(resolve(folderPath, "copy"));
        assert.ok(
          copyFiles.includes("copy.ts"),
          `Modularized component '${folder}' copy/ directory must contain copy.ts`
        );
      }
    }

    const importsFiles = readdirSync(resolve(folderPath, "imports"));
    assert.ok(
      importsFiles.includes("imports.ts"),
      `Modularized component '${folder}' imports/ directory must contain imports.ts`
    );
  }
});
