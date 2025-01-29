#!/usr/bin/env node
import { startup } from "./server.js";

startup().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});