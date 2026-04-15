import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3000;

const ONPE_PAGE_URL = "https://resultadoelectoral.onpe.gob.pe/main/resumen";
const CACHE_TTL_MS = 15_000;

let browser;
let context;
let page;

const cache = new Map();

async function getBrowserPage() {
  if (browser && context && page) {
    return { browser, context, page };
  }

  browser = await chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage"
    ]
  });

  context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
    extraHTTPHeaders: {
      "Accept-Language": "es-ES,es;q=0.9"
    }
  });

  page = await context.newPage();

  return { browser, context, page };
}

async function ensureOnpeLoaded() {
  const { page } = await getBrowserPage();

  if (!page.url() || !page.url().includes("resultadoelectoral.onpe.gob.pe")) {
    await page.goto(ONPE_PAGE_URL, {
      waitUntil: "networkidle",
      timeout: 60000
    });
    return;
  }

  await page.reload({
    waitUntil: "networkidle",
    timeout: 60000
  });
}

async function captureOnpeJson(targetPathPart) {
  const cached = cache.get(targetPathPart);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL_MS) {
    return {
      ...cached.data,
      cached: true
    };
  }

  const { page } = await getBrowserPage();

  const responsePromise = page.waitForResponse(
    (response) => response.url().includes(targetPathPart),
    { timeout: 60000 }
  );

  await ensureOnpeLoaded();

  const response = await responsePromise;
  const contentType = response.headers()["content-type"] || "";
  const raw = await response.text();

  let parsed = null;
  if (contentType.includes("application/json")) {
    try {
      parsed = JSON.parse(raw);
    } catch { }
  }

  const result = {
    ok: response.ok(),
    status: response.status(),
    url: response.url(),
    contentType,
    parsed,
    preview: raw.slice(0, 500),
    cached: false
  };

  cache.set(targetPathPart, {
    timestamp: now,
    data: result
  });

  return result;
}

async function handleOnpeRequest(res, pathPart, errorMessage) {
  try {
    const result = await captureOnpeJson(pathPart);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: errorMessage,
      error: error.message
    });
  }
}

app.get("/", (req, res) => {
  res.send("Servidor ONPE activo");
});

app.get("/api/onpe", async (req, res) => {
  await handleOnpeRequest(
    res,
    "/presentacion-backend/resumen-general/totales",
    "Error capturando respuesta ONPE"
  );
});

app.get("/api/onpe/totales", async (req, res) => {
  await handleOnpeRequest(
    res,
    "/presentacion-backend/resumen-general/totales",
    "Error capturando totales"
  );
});

app.get("/api/onpe/participantes", async (req, res) => {
  await handleOnpeRequest(
    res,
    "/presentacion-backend/resumen-general/participantes",
    "Error capturando participantes"
  );
});

app.get("/health", (req, res) => {
  res.json({
    ok: true,
    uptime: process.uptime()
  });
});

async function shutdown() {
  try {
    if (browser) {
      await browser.close();
    }
  } catch { }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});