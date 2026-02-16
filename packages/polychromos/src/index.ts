#!/usr/bin/env node
import { Command } from "commander";

// Initialize Sentry before anything else
import { initSentry, closeSentry } from "./lib/sentry.js";
initSentry();

import { checkpointCommand } from "./commands/checkpoint.js";
import { devCommand } from "./commands/dev.js";
import { exportCommand } from "./commands/export.js";
import { historyCommand } from "./commands/history.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { logoutCommand } from "./commands/logout.js";
import { redoCommand } from "./commands/redo.js";
import { telemetryCommand } from "./commands/telemetry.js";
import { undoCommand } from "./commands/undo.js";
import { whoamiCommand } from "./commands/whoami.js";
import { getVersion } from "./lib/version.js";

const program = new Command();

program
  .name("polychromos")
  .description("Code-driven design platform CLI")
  .version(getVersion());

// Auth commands
program
  .command("login")
  .description("Authenticate with Polychromos")
  .action(loginCommand);

program
  .command("logout")
  .description("Log out of Polychromos")
  .action(logoutCommand);

program
  .command("whoami")
  .description("Show current authentication status")
  .action(whoamiCommand);

// Project commands
program
  .command("init <name>")
  .description("Initialize a new design file")
  .action(initCommand);

program
  .command("dev")
  .description("Watch and sync design file to Convex")
  .action(devCommand);

program.command("undo").description("Undo last change").action(undoCommand);

program.command("redo").description("Redo undone change").action(redoCommand);

program
  .command("history")
  .description("Show version history")
  .action(historyCommand);

program
  .command("checkpoint <name>")
  .description("Create a named checkpoint")
  .action(checkpointCommand);

program
  .command("export <format>")
  .description("Export design (html, tailwind)")
  .action(exportCommand);

// Telemetry command
program
  .command("telemetry <action>")
  .description("Manage anonymous telemetry (enable|disable|status)")
  .action(telemetryCommand);

// Ensure Sentry flushes before exit
process.on("beforeExit", () => {
  void closeSentry();
});

process.on("SIGTERM", () => {
  void closeSentry().then(() => {
    process.exit(0);
  });
});

program.parse();
