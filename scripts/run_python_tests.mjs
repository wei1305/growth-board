import { spawnSync } from "node:child_process";

const candidates = process.platform === "win32"
  ? [["py", "-3"], ["python", ""]]
  : [["python3", ""], ["python", ""]];

for (const [command, launcherArg] of candidates) {
  const prefix = launcherArg ? [launcherArg] : [];
  const probe = spawnSync(command, [...prefix, "--version"], { stdio: "ignore" });

  if (!probe.error && probe.status === 0) {
    const result = spawnSync(
      command,
      [...prefix, "-m", "unittest", "discover", "-s", "scripts/tests", "-p", "test_*.py"],
      { stdio: "inherit" },
    );
    process.exit(result.status ?? 1);
  }
}

console.error("Python 3 is required to run the exporter tests.");
process.exit(1);
