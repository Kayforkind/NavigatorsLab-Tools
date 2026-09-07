/* Run via python scripts/update-status.py — kept as .cjs shim for npm script parity. */
require("node:child_process").execFileSync("python", ["scripts/update-status.py"], { stdio: "inherit" });
