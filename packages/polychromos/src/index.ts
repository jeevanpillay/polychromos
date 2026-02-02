#!/usr/bin/env node
import { Command } from "commander";

import { checkpointCommand } from "./commands/checkpoint.js";
import { devCommand } from "./commands/dev.js";
import { exportCommand } from "./commands/export.js";
import { historyCommand } from "./commands/history.js";
import { initCommand } from "./commands/init.js";
import { redoCommand } from "./commands/redo.js";
import { undoCommand } from "./commands/undo.js";

const program = new Command();

program
  .name("polychromos")
  .description("Code-driven design platform CLI")
  .version("1.0.0");

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

program.parse();
