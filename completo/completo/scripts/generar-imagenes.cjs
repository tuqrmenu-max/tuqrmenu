const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const DOWNLOAD_PATH = path.resolve(__dirname, '../downloads/qwen');
const INPUT_PATH = path.resolve(__dirname, '../missing-products.json');
const USER_DATA = path.resolve(__dirname, '../.qwen-browser-data');

function log(msg) { console.log(`[Qwen] ${msg}`); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sanitizeFilename(name) {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s.-]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

function promptFor(product) {
  const name = (product.producto || 'producto gastronómico').trim();
  const detail = (product.detalle || '').trim();
  const cat = (product.categoria || 'Gastronomía').trim();
  const extra = detail ? ` Descripción: ${detail}.` : '';
  return `Genera una imagen ultra realista gastronómica de ${name}, categoría ${cat}.${extra} Presentación apetitosa, producto centrado, vista tres cuartos, iluminación de estudio, sin texto, sin personas, sin marco. Imagen cuadrada 300x300px, fondo transparente, formato WEBP.`;
}

function getExistingImages() {
  if (!fs.existsSync(DOWNLOAD_PATH)) return new Set();
  return new Set(fs.readdirSync(DOWNLOAD_PATH).filter(f => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg')));
}

async function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return downloadImage(res.headers.location, filepath).then(resolve).catch(reject);
      }
      const stream = fs.createWriteStream(filepath);
      res.pipe(stream);
      stream.on('finish', () => { stream.close(); resolve(); });
      stream.on('error', reject);
    }).on('error', reject);
  });
}

async function ensureOnQwen(page) {
  const url = page.url();
  if (!url.includes('chat.qwen.ai')) {
    log('  Navegando de vuelta a chat.qwen.ai...');
    await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000);
  }
}

async function waitForLogin(page) {
  log('Esperando login del usuario...');
  log('Si el navegador se abrió, hacé login en chat.qwen.ai');
  log('El script continuará automáticamente cuando detecte que estás logueado');

  while (true) {
    try {
      const url = page.url();
      if (url.includes('chat.qwen.ai') && !url.includes('login') && !url.includes('oauth')) {
        const textarea = await page.$('textarea.message-input-textarea');
        if (textarea) {
          const isVisible = await textarea.isVisible();
          if (isVisible) {
            log('Login detectado!');
            return true;
          }
        }
      }
    } catch (e) {}
    await sleep(2000);
  }
}

async function generateImage(page, prompt, productName, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      log(`  Intento ${attempt}/${retries}...`);

      await ensureOnQwen(page);

      const textarea = await page.waitForSelector('textarea.message-input-textarea', { timeout: 15000 });
      await textarea.click();
      await sleep(500);

      await page.keyboard.press('Control+A');
      await page.keyboard.press('Backspace');
      await sleep(300);

      await textarea.fill(prompt);
      await sleep(500);

      const imagesBefore = await page.$$eval('img', imgs =>
        imgs.filter(img => img.src && (img.src.includes('data:image') || img.src.includes('blob:'))).length
      );

      await page.keyboard.press('Enter');
      log('  Prompt enviado, esperando generación...');

      const startTime = Date.now();
      const timeout = 90000;
      let imageUrl = null;

      while (Date.now() - startTime < timeout) {
        await sleep(3000);

        const currentUrl = page.url();
        if (currentUrl.includes('login') || currentUrl.includes('oauth') || currentUrl.includes('google')) {
          log('  Sesión expirada, esperando login...');
          await waitForLogin(page);
          throw new Error('Sesión reestablecida, reintentando...');
        }

        try {
          const images = await page.$$eval('img', (imgs, before) => {
            const newImgs = imgs.filter(img => {
              const src = img.src || '';
              return src && src.length > 100 && (
                src.includes('data:image') ||
                src.includes('blob:') ||
                src.includes('qwen') ||
                src.includes('alicdn') ||
                src.includes('alibaba')
              ) && img.width > 50 && img.height > 50;
            });
            return newImgs.slice(before).map(img => ({
              src: img.src,
              width: img.naturalWidth,
              height: img.naturalHeight
            }));
          }, imagesBefore);

          if (images.length > 0) {
            imageUrl = images[images.length - 1].src;
            log(`  Imagen encontrada (${images[images.length - 1].width}x${images[images.length - 1].height})`);
            break;
          }
        } catch (e) {}
      }

      if (!imageUrl) {
        log('  Timeout esperando imagen');
        if (attempt < retries) {
          log('  Recargando página...');
          try {
            await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
          } catch (e) {
            await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          }
          await sleep(3000);
          continue;
        }
        throw new Error('No se pudo generar la imagen después de varios intentos');
      }

      return imageUrl;

    } catch (err) {
      log(`  Error en intento ${attempt}: ${err.message}`);
      if (attempt < retries) {
        await sleep(2000);
        try {
          await page.reload({ waitUntil: 'domcontentloaded', timeout: 15000 });
        } catch (e) {
          try {
            await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
          } catch (e2) {}
        }
        await sleep(3000);
      }
    }
  }
  throw new Error(`No se pudo generar imagen para ${productName}`);
}

async function main() {
  log('=== Generador automático de imágenes con Qwen (Playwright) ===');

  if (!fs.existsSync(DOWNLOAD_PATH)) fs.mkdirSync(DOWNLOAD_PATH, { recursive: true });

  if (!fs.existsSync(INPUT_PATH)) {
    log(`Error: No se encontró ${INPUT_PATH}`);
    log('Abrí el Builder, hacé clic en "Exportar productos faltantes" y guardá el archivo en la raíz del proyecto');
    process.exit(1);
  }

  const pending = JSON.parse(fs.readFileSync(INPUT_PATH, 'utf8'));
  log(`${pending.length} productos cargados desde missing-products.json`);

  const existing = getExistingImages();
  log(`${existing.size} imágenes ya existen en downloads/qwen/`);

  const toGenerate = pending.filter(p => {
    const filename = sanitizeFilename(p.producto);
    return !existing.has(`${filename}.webp`) && !existing.has(`${filename}.png`) && !existing.has(`${filename}.jpg`);
  });

  log(`${toGenerate.length} productos pendientes de generar`);
  if (toGenerate.length === 0) { log('¡Todas las imágenes ya están generadas!'); return; }

  log('Lanzando navegador...');
  let context;
  try {
    context = await chromium.launchPersistentContext(USER_DATA, {
      channel: 'chrome',
      headless: false,
      viewport: { width: 1280, height: 800 },
      args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
    });
  } catch (e) {
    log(`Error lanzando navegador: ${e.message}`);
    log('Asegurate de que Chrome esté cerrado');
    process.exit(1);
  }

  const page = context.pages()[0] || await context.newPage();

  log('Navegando a chat.qwen.ai...');
  try {
    await page.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  } catch (e) {
    log(`Error navegando: ${e.message}`);
  }
  await sleep(3000);

  await waitForLogin(page);
  await sleep(2000);

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < toGenerate.length; i++) {
    const prod = toGenerate[i];
    const prompt = promptFor(prod);
    const filename = sanitizeFilename(prod.producto);

    log(`\n[${i + 1}/${toGenerate.length}] ${prod.producto}`);

    const currentExisting = getExistingImages();
    if (currentExisting.has(`${filename}.webp`) || currentExisting.has(`${filename}.png`)) {
      log('Ya existe, saltando...');
      completed++;
      continue;
    }

    try {
      if (context.isClosed()) {
        log('El navegador se cerró. Reabriendo...');
        context = await chromium.launchPersistentContext(USER_DATA, {
          channel: 'chrome',
          headless: false,
          viewport: { width: 1280, height: 800 },
          args: ['--no-sandbox', '--disable-blink-features=AutomationControlled']
        });
        const newPage = context.pages()[0] || await context.newPage();
        await newPage.goto('https://chat.qwen.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
        await sleep(3000);
        await waitForLogin(newPage);
      }

      const newChatBtn = await page.$('div[aria-label="New Chat"]');
      if (newChatBtn) {
        await newChatBtn.click();
        await sleep(2000);
      }

      const imageUrl = await generateImage(page, prompt, prod.producto);

      const ext = imageUrl.startsWith('data:') ? 'png' : 'webp';
      const filepath = path.join(DOWNLOAD_PATH, `${filename}.${ext}`);

      if (imageUrl.startsWith('data:image')) {
        const base64 = imageUrl.split(',')[1];
        const buffer = Buffer.from(base64, 'base64');
        fs.writeFileSync(filepath, buffer);
        log(`  Guardada: ${filename}.${ext}`);
      } else if (imageUrl.startsWith('blob:')) {
        try {
          const imgData = await page.evaluate(async (url) => {
            const response = await fetch(url);
            const blob = await response.blob();
            return new Promise((resolve) => {
              const reader = new FileReader();
              reader.onloadend = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });
          }, imageUrl);

          if (imgData) {
            const base64 = imgData.split(',')[1];
            const buffer = Buffer.from(base64, 'base64');
            fs.writeFileSync(filepath, buffer);
            log(`  Guardada: ${filename}.${ext}`);
          }
        } catch (e) {
          log(`  Error guardando blob: ${e.message}`);
        }
      } else {
        await downloadImage(imageUrl, filepath);
        log(`  Guardada: ${filename}.${ext}`);
      }

      completed++;

      if (i < toGenerate.length - 1) {
        log('  Esperando 5 segundos antes del siguiente...');
        await sleep(5000);
      }

    } catch (err) {
      log(`  ERROR: ${err.message}`);
      failed++;
      log('  Continuando con el siguiente producto...');
    }
  }

  log('\nGenerando images-map.json...');
  const allImages = fs.readdirSync(DOWNLOAD_PATH).filter(f => f.endsWith('.webp') || f.endsWith('.png') || f.endsWith('.jpg'));
  const mapping = {};
  pending.forEach(p => {
    const filename = sanitizeFilename(p.producto);
    const found = allImages.find(f => f.startsWith(filename));
    if (found) mapping[p.producto] = path.join(DOWNLOAD_PATH, found);
  });
  const mapPath = path.resolve(__dirname, '../public/images-map.json');
  fs.writeFileSync(mapPath, JSON.stringify(mapping, null, 2));
  log(`Mapa de imágenes guardado en: ${mapPath}`);

  log('\n=== Proceso finalizado ===');
  log(`Imágenes generadas: ${completed}`);
  log(`Fallidas: ${failed}`);
  log(`Total imágenes en carpeta: ${allImages.length}`);
  log('Abrí el Builder y hacé clic en "Cargar imágenes generadas (del script)"');

  try {
    await context.close();
  } catch (e) {}
}

main().catch(e => { log(`Error fatal: ${e.message}`); process.exit(1); });
