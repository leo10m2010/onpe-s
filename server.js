import express from "express";
import { chromium } from "playwright";

const app = express();
const PORT = process.env.PORT || 3000;

async function fetchOnpe(path) {
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

    const data = await page.evaluate(async (urlPath) => {
      const response = await fetch(`https://resultadoelectoral.onpe.gob.pe${urlPath}`);
      const contentType = response.headers.get("content-type") || "";
      const raw = await response.text();

      return {
        ok: response.ok,
        status: response.status,
        contentType,
        raw
      };
    }, path);

    let parsed = null;
    if (data.contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(data.raw);
      } catch { }
    }

    return {
      ok: true,
      status: data.status,
      contentType: data.contentType,
      parsed,
      preview: data.raw.slice(0, 500)
    };
  } finally {
    if (browser) await browser.close();
  }
}

app.get("/", (req, res) => {
  res.send("Servidor ONPE activo");
});

app.get("/api/onpe/totales", async (req, res) => {
  try {
    const result = await fetchOnpe(
      "/presentacion-backend/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error consultando totales",
      error: error.message
    });
  }
});

app.get("/api/onpe/participantes", async (req, res) => {
  try {
    const result = await fetchOnpe(
      "/presentacion-backend/resumen-general/participantes?idEleccion=10&tipoFiltro=eleccion"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error consultando participantes",
      error: error.message
    });
  }
});

app.get("/api/onpe/elecciones", async (req, res) => {
  try {
    const result = await fetchOnpe(
      "/presentacion-backend/elecciones"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error consultando elecciones",
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});