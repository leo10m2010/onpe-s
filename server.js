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

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36",
      extraHTTPHeaders: {
        "Accept-Language": "es-ES,es;q=0.9"
      }
    });

    const page = await context.newPage();

    await page.goto("https://resultadoelectoral.onpe.gob.pe/main/resumen", {
      waitUntil: "domcontentloaded",
      timeout: 60000
    });

    await page.waitForTimeout(3000);

    const response = await context.request.get(
      `https://resultadoelectoral.onpe.gob.pe${path}`,
      {
        headers: {
          "Accept": "application/json, text/plain, */*",
          "Referer": "https://resultadoelectoral.onpe.gob.pe/main/resumen",
          "Origin": "https://resultadoelectoral.onpe.gob.pe",
          "X-Requested-With": "XMLHttpRequest"
        }
      }
    );

    const status = response.status();
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
      status,
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
    const result = await fetchOnpe(
      "/presentacion-backend/resumen-general/totales?idEleccion=10&tipoFiltro=eleccion"
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({
      ok: false,
      message: "Error consultando ONPE",
      error: error.message
    });
  }
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