import { readFile, writeFile } from "fs/promises";
import { join } from "path";

export interface PolychromosConfig {
  convexUrl: string;
  workspaceId: string;
}

const CONFIG_DIR = ".polychromos";
const CONFIG_FILE = "config.json";

export async function loadConfig(): Promise<PolychromosConfig | null> {
  try {
    const configPath = join(CONFIG_DIR, CONFIG_FILE);
    const content = await readFile(configPath, "utf-8");
    const config = JSON.parse(content) as PolychromosConfig;

    // Validate required fields
    if (!config.convexUrl || !config.workspaceId) {
      return null;
    }

    return config;
  } catch {
    // Config file doesn't exist or is invalid
    return null;
  }
}

export async function saveConfig(config: PolychromosConfig): Promise<void> {
  const configPath = join(CONFIG_DIR, CONFIG_FILE);
  await writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}
