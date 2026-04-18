import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Normalize URL: collapse multiple slashes (e.g. "/v1//chat/completions" → "/v1/chat/completions")
// This handles clients that configure base URL with trailing slash like "https://host/v1/"
app.use((req, _res, next) => {
  if (req.url.includes("//")) {
    const [path, query] = req.url.split("?");
    req.url = (path ?? "/").replace(/\/{2,}/g, "/") + (query ? `?${query}` : "");
  }
  next();
});

app.use("/api", router);
// Also mount at /v1 for standard OpenAI-compatible base URL
// (requires artifact routing to forward /v1/* to this server)
app.use("/v1", router);

// Friendly catch-all for unknown paths (helps users debug wrong base URLs)
app.use((req, res) => {
  res.status(404).json({
    error: {
      message: `Endpoint '${req.method} ${req.path}' not found. Use base URL '<host>/v1' (no trailing slash) with paths like /chat/completions, /messages, /models.`,
      type: "endpoint_not_found",
      code: 404,
    },
  });
});

export default app;
