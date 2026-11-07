import app from "../src/cloud/runtime/hono";

export const config = {
  runtime: "edge"
};

export default app.fetch;

