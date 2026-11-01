// Runs the end-to-end suite in the Linux Playwright image - the one place screenshots are made
// and compared, as CI runs them (.github/workflows/e2e.yml). Fonts are drawn differently on
// every system, so baselines made on Windows or a Mac would fail in CI on pixels alone.
//
//   npm run test:e2e:docker                       everything, screenshots compared
//   npm run test:e2e:update                       remake the screenshots (@visual only)
//   node tests/e2e/docker.mjs --grep @layout      one kind of test
//   node tests/e2e/docker.mjs --project desktop   one project; any other flag is passed on
//
// PW_PIXEL_RATIO=0 before an update rewrites every baseline that differs at all: within the
// usual tolerance an update keeps the old picture, so a reworded label could stay recorded.
//
// The sources are copied into the container, not mounted, so its Linux node_modules and build
// never touch this checkout's (Windows binaries in node_modules would break the build there).
// What is copied is what git would ship - tracked files and untracked ones no .gitignore drops -
// so a file the tests need but git ignores fails here too, not first in CI. Only the report, the
// failures and, with --update, the baselines come back.

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const { version } = JSON.parse(readFileSync(join(root, "node_modules", "@playwright", "test", "package.json"), "utf8"));
// The image and the installed @playwright/test must be the same version, or the browsers differ.
const image = `mcr.microsoft.com/playwright:v${version}-noble`;

const args = process.argv.slice(2);
const update = args.includes("--update");
const pass = args.filter((a) => a !== "--update");
if (update) {
  pass.push("--update-snapshots");
  if (!pass.includes("--grep") && !pass.includes("-g")) pass.push("--grep", "@visual");
}
const quoted = pass.map((a) => `'${a.replace(/'/g, "'\\''")}'`).join(" ");

const git = spawnSync("git", ["-C", root, "-c", "core.quotePath=false", "ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" });
if (git.status !== 0) throw new Error(`git could not list the files: ${git.stderr}`);
// A file deleted from the working copy but still in the index is not shipped either.
const files = git.stdout.split("\0").filter((f) => f && existsSync(join(root, f)));

const dir = mkdtempSync(join(tmpdir(), "appolino-e2e-"));
writeFileSync(join(dir, "files.txt"), `${files.join("\n")}\n`);
writeFileSync(
  join(dir, "run.sh"),
  [
    "set -e",
    "mkdir -p /work",
    "tar -C /src -cf - -T /files.txt | tar -C /work -xf -",
    "cd /work",
    "npm ci --no-audit --no-fund --loglevel=error",
    "set +e",
    `npx playwright test ${quoted}`,
    "code=$?",
    "set -e",
    "rm -rf /src/playwright-report /src/test-results || true",
    "cp -r playwright-report /src/ 2>/dev/null || true",
    "cp -r test-results /src/ 2>/dev/null || true",
    // A failed delete must not stop the copy, or every baseline would be gone (bdop, 2026-10-04).
    update ? "rm -rf /src/tests/e2e/__screenshots__ || true; cp -r tests/e2e/__screenshots__ /src/tests/e2e/" : "true",
    "exit $code",
    "",
  ].join("\n"),
);

const name = "appolino-e2e";
spawnSync("docker", ["rm", "-f", name], { stdio: "ignore" });
const run = spawnSync(
  "docker",
  [
    "run", "--rm", "--ipc=host", "--name", name,
    "-e", "E2E_VISUAL=1",
    "-e", "PW_PIXEL_RATIO",
    "-v", `${root}:/src`,
    "-v", `${join(dir, "run.sh")}:/run.sh:ro`,
    "-v", `${join(dir, "files.txt")}:/files.txt:ro`,
    "-v", "appolino-npm-cache:/root/.npm",
    image, "bash", "/run.sh",
  ],
  { stdio: "inherit" },
);
process.exit(run.status ?? 1);
