/// <reference types="vite/client" />
import { ConvexReactClient } from "convex/react";
import { api } from "../convex/_generated/api.js";

const convexUrl =
  (import.meta as any).env?.VITE_CONVEX_URL ||
  "https://accomplished-caiman-728.convex.cloud";

export const convex = new ConvexReactClient(convexUrl);
export { api };
