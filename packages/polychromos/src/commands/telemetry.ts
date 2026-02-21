import {
  isTelemetryEnabled,
  setTelemetryEnabled,
} from "../lib/telemetry-config.js";

export function telemetryCommand(
  action: "enable" | "disable" | "status",
): void {
  switch (action) {
    case "enable": {
      setTelemetryEnabled(true);
      console.log("✓ Telemetry enabled. Thank you for helping improve Polychromos!");
      console.log("");
      console.log("We collect anonymous error reports to fix bugs and improve the CLI.");
      console.log("Learn more: https://polychromos.dev/telemetry");
      break;
    }

    case "disable": {
      setTelemetryEnabled(false);
      console.log("✓ Telemetry disabled. No data will be sent.");
      console.log("");
      console.log("You can re-enable anytime: polychromos telemetry enable");
      console.log("Or set: POLYCHROMOS_TELEMETRY_DISABLED=1");
      break;
    }

    case "status": {
      // eslint-disable-next-line turbo/no-undeclared-env-vars
      const envDisabled = process.env.POLYCHROMOS_TELEMETRY_DISABLED === "1";
      const configEnabled = isTelemetryEnabled();

      console.log("Telemetry Status");
      console.log("━━━━━━━━━━━━━━━━");

      if (envDisabled) {
        console.log("Status: DISABLED (via POLYCHROMOS_TELEMETRY_DISABLED=1)");
      } else if (configEnabled) {
        console.log("Status: ENABLED (default)");
      } else {
        console.log("Status: DISABLED (via user preference)");
      }

      console.log("");
      console.log("Telemetry helps us improve Polychromos by collecting anonymous error reports.");
      console.log("To change: polychromos telemetry enable|disable");
      console.log("Learn more: https://polychromos.dev/telemetry");
      break;
    }
  }
}
