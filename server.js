import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3000;

async function captureOnpeJson(targetPathPart, pageUrl) {
  let browser;

  try {
    browser = await chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage"
      ]
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "es-ES,es;q=0.9"
      }
    });

    const page = await context.newPage();

    const responsePromise = page.waitForResponse(
      (response) => response.url().includes(targetPathPart),
      { timeout: 60000 }
    );

    await page.goto(pageUrl, {
      waitUntil: "networkidle",
      timeout: 60000
    });

    const response = await responsePromise;
    const contentType = response.headers()["content-type"] || "";
    const raw = await response.text();

    let parsed = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(raw);
      } catch { }
    }

    return {
      ok: response.ok(),
      status: response.status(),
      url: response.url(),
      contentType,
      parsed,
      preview: raw.slice(0, 500)
    };
  } finally {
    if (browser) await browser.close();
  }
}

app.get("/", (req, res) => {
  res.send("Servidor ONPE activo");
});

app.get("/api/onpe", async (req, res) => {
  try {
    const result = await captureOnpeJson(
      "/presentacion-backend/resumen-general/totales",
      "https://resultadoelectoral.onpe.gob.pe/main/resumen"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error capturando respuesta ONPE",
      error: error.message
    });
  }
});

app.get("/api/onpe/totales", async (req, res) => {
  try {
    const result = await captureOnpeJson(
      "/presentacion-backend/resumen-general/totales",
      "https://resultadoelectoral.onpe.gob.pe/main/resumen"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error capturando totales",
      error: error.message
    });
  }
});

app.get("/api/onpe/participantes", async (req, res) => {
  try {
    const result = await captureOnpeJson(
      "/presentacion-backend/resumen-general/participantes",
      "https://resultadoelectoral.onpe.gob.pe/main/resumen"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error capturando participantes",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});