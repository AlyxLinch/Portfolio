const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");

const root = __dirname;
const port = 4173;
const httpsPort = 4174;
const settingsJsPath = path.join(root, "shared", "wave-config.js");
const httpsCertPath = path.join(root, "certs", "localhost-cert.pem");
const httpsKeyPath = path.join(root, "certs", "localhost-key.pem");
const maxJsonBodyBytes = 256 * 1024;

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml"
};

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > maxJsonBodyBytes) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

function serializeSettingValue(value, indentLevel = 1) {
  const indent = "  ".repeat(indentLevel);
  const nextIndent = "  ".repeat(indentLevel + 1);

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Settings contain a non-finite number.");
    }

    return String(Number(value.toPrecision(12)));
  }

  if (typeof value === "boolean") {
    return String(value);
  }

  if (value && typeof value === "object" && !Array.isArray(value)) {
    const entries = Object.entries(value)
      .map(([key, entryValue]) => `${nextIndent}${key}: ${serializeSettingValue(entryValue, indentLevel + 1)}`)
      .join(",\n");

    return `{\n${entries}\n${indent}}`;
  }

  throw new Error("Settings contain an unsupported value.");
}

function serializeSettingsBlock(settings) {
  if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
    throw new Error("Invalid settings payload.");
  }

  const entries = Object.entries(settings)
    .map(([key, value]) => `  ${key}: ${serializeSettingValue(value)}`)
    .join(",\n");

  return `export const settings = {\n${entries}\n};`;
}

function replaceSettingsBlock(source, settingsBlock) {
  const startToken = "export const settings = {";
  const start = source.indexOf(startToken);

  if (start === -1) {
    throw new Error("Could not find settings export in shared/wave-config.js");
  }

  let depth = 0;
  let end = -1;

  for (let index = start + "export const settings = ".length; index < source.length; index++) {
    const char = source[index];

    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth -= 1;

      if (depth === 0) {
        const semicolon = source.indexOf(";", index);
        if (semicolon === -1) {
          throw new Error("Could not find settings export terminator.");
        }

        end = semicolon + 1;
        break;
      }
    }
  }

  if (end === -1) {
    throw new Error("Could not parse settings export.");
  }

  return `${source.slice(0, start)}${settingsBlock}${source.slice(end)}`;
}

function saveSettings(settings) {
  const source = fs.readFileSync(settingsJsPath, "utf8");
  const settingsBlock = serializeSettingsBlock(settings);
  const nextSource = replaceSettingsBlock(source, settingsBlock);

  fs.writeFileSync(settingsJsPath, nextSource);
}

async function handleSaveSettings(request, response) {
  try {
    const body = await readRequestBody(request);
    const values = JSON.parse(body);

    saveSettings(values.settings || values);
    send(response, 200, JSON.stringify({ ok: true }), contentTypes[".json"]);
  } catch (error) {
    send(
      response,
      400,
      JSON.stringify({ ok: false, error: error.message }),
      contentTypes[".json"]
    );
  }
}

function serveFile(request, response) {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const requestedPath = url.pathname === "/"
    ? "/index.html"
    : url.pathname.endsWith("/")
      ? `${url.pathname}index.html`
      : url.pathname;
  const filePath = path.normalize(path.join(root, requestedPath));

  if (!filePath.startsWith(root)) {
    send(response, 403, "Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      send(response, 404, "Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": contentTypes[ext] || "application/octet-stream"
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    response.end(data);
  });
}

function handleRequest(request, response) {
  if (request.method === "GET" && request.url === "/api/render/status") {
    send(response, 200, JSON.stringify({ ok: true }), contentTypes[".json"]);
    return;
  }

  if (request.method === "POST" && request.url === "/api/settings") {
    handleSaveSettings(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    send(response, 405, "Method not allowed");
    return;
  }

  serveFile(request, response);
}

const server = http.createServer(handleRequest);

server.listen(port, "127.0.0.1", () => {
  console.log(`Wave tuner running at http://127.0.0.1:${port}/`);
});

if (fs.existsSync(httpsKeyPath) && fs.existsSync(httpsCertPath)) {
  const httpsServer = https.createServer(
    {
      cert: fs.readFileSync(httpsCertPath),
      key: fs.readFileSync(httpsKeyPath)
    },
    handleRequest
  );

  httpsServer.listen(httpsPort, "127.0.0.1", () => {
    console.log(`Wave tuner running at https://localhost:${httpsPort}/`);
  });
} else {
  console.log("HTTPS certs not found; local HTTPS server was not started.");
}
