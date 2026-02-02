"use client";

import { useEffect, useState } from "react";

export function MelbourneTime() {
  const [time, setTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const formatter = new Intl.DateTimeFormat("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Australia/Melbourne",
      });

      const parts = formatter.formatToParts(new Date());
      const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
      const minute = parts.find((p) => p.type === "minute")?.value ?? "00";

      setTime(`${hour}:${minute}`);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <span
      suppressHydrationWarning
      className="font-mono text-xs tracking-widest uppercase"
    >
      {time || "--:--"} MELBOURNE, AU
    </span>
  );
}
