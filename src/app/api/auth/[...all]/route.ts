import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/features/access/auth";

export const { GET, POST } = toNextJsHandler(auth);
