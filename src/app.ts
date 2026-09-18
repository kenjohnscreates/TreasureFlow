import { Hono } from "hono";
import agent from "./chat/http.ts";

export const app: Hono = agent;
export default app;
