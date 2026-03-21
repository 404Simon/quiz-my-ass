#!/usr/bin/env bun

import { $ } from "bun";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import solidPlugin from "../node_modules/@opentui/solid/scripts/solid-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dir = path.resolve(__dirname, "..");

process.chdir(dir);

const singleFlag = process.argv.includes("--single") || (!!process.env.CI && !process.argv.includes("--all"));

const allTargets: {
  os: string;
  arch: "arm64" | "x64";
  abi?: "musl";
  avx2?: false;
}[] = [
  { os: "linux", arch: "arm64" },
  { os: "linux", arch: "x64" },
  { os: "linux", arch: "x64", avx2: false },
  { os: "linux", arch: "arm64", abi: "musl" },
  { os: "linux", arch: "x64", abi: "musl" },
  { os: "linux", arch: "x64", abi: "musl", avx2: false },
  { os: "darwin", arch: "arm64" },
  { os: "darwin", arch: "x64" },
  { os: "darwin", arch: "x64", avx2: false },
  { os: "win32", arch: "x64" },
  { os: "win32", arch: "x64", avx2: false },
];

const targets = singleFlag
  ? allTargets.filter((item) => {
      if (item.os !== process.platform || item.arch !== process.arch) {
        return false;
      }
      if (item.avx2 === false) {
        return false;
      }
      if (item.abi !== undefined) {
        return false;
      }
      return true;
    })
  : allTargets;

const pkgName = "quiz-my-ass";

await $`rm -rf dist`;

const binaries: Record<string, string> = {};
await $`bun install --os="*" --cpu="*" @opentui/core@${JSON.parse(fs.readFileSync("./package.json", "utf-8")).dependencies["@opentui/core"]}`;
await $`bun install --os="*" --cpu="*" @opentui/solid@${JSON.parse(fs.readFileSync("./package.json", "utf-8")).dependencies["@opentui/solid"]}`;

for (const item of targets) {
  const name = [pkgName, item.os === "win32" ? "windows" : item.os, item.arch, item.avx2 === false ? "baseline" : undefined, item.abi === undefined ? undefined : item.abi].filter(Boolean).join("-");
  console.log(`building ${name}`);
  await $`mkdir -p dist/${name}/bin`;

  const parserWorker = fs.realpathSync(path.resolve(dir, "./node_modules/@opentui/core/parser.worker.js"));
  const bunfsRoot = item.os === "win32" ? "B:/~BUN/root/" : "/$bunfs/root/";
  const workerRelativePath = path.relative(dir, parserWorker).replaceAll("\\", "/");
  const exeExtension = item.os === "win32" ? ".exe" : "";

  const result = await Bun.build({
    conditions: ["browser"],
    plugins: [solidPlugin],
    sourcemap: "external",
    compile: {
      autoloadBunfig: false,
      autoloadDotenv: false,
      target: name.replace(pkgName, "bun").replace("windows", "win32") as any,
      outfile: `dist/${name}/bin/${pkgName}${exeExtension}`,
      execArgv: ["--"],
      windows: {},
    },
    entrypoints: ["./src/index.tsx", parserWorker],
    define: {
      OTUI_TREE_SITTER_WORKER_PATH: bunfsRoot + workerRelativePath,
    },
  });

  if (!result.success) {
    console.error(`Failed to build ${name}`);
    for (const log of result.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  await Bun.file(`dist/${name}/package.json`).write(
    JSON.stringify({
      name,
      version: "1.0.0",
      os: [item.os],
      cpu: [item.arch],
    }, null, 2)
  );
  binaries[name] = "1.0.0";
  console.log(`✓ ${name} built successfully`);
}

export { binaries };
