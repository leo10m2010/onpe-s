import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Servidor ONPE activo. Prueba /api/onpe");
});

app.get("/api/onpe", async (req, res) => {
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

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36"
    });

    await page.goto("https://resultadoelectoral.onpe.gob.pe/main/resumen", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const data = await page.evaluate(async () => {
      const response = await fetch(
        "https://resultadoelectoral.onpe.gob.pe/presentacion-backend/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion"
      );

      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        raw
      };
    });

    let parsed = null;
    if (data.contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(data.raw);
      } catch { }
    }

    res.json({
      ok: true,
      status: data.status,
      contentType: data.contentType,
      parsed,
      preview: data.raw.slice(0, 500)
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error consultando ONPE",
      error: error.message
    });
  } finally {
    if (browser) await browser.close();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});