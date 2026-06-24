import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const chromePath = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const frameDirectory = path.join(root, "webpage", "assets", "scroll-demo-frames");
const outputPath = path.join(root, "webpage", "assets", "scroll-demo-boomerang.mp4");
const width = 960;
const height = 600;
const fps = 30;
const forwardSeconds = 3;
const frameCount = fps * forwardSeconds;

await rm(frameDirectory, { recursive: true, force: true });
await mkdir(frameDirectory, { recursive: true });

const chrome = spawn(
  chromePath,
  [
    "--headless=new",
    "--remote-debugging-pipe",
    "--ignore-certificate-errors",
    "--enable-unsafe-swiftshader",
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--hide-scrollbars",
    `--window-size=${width},${height}`,
    "http://127.0.0.1:4173/scroll-demo/"
  ],
  {
    stdio: ["ignore", "ignore", "inherit", "pipe", "pipe"]
  }
);

let nextId = 1;
let readBuffer = Buffer.alloc(0);
const pending = new Map();
const browserInput = chrome.stdio[3];
const browserOutput = chrome.stdio[4];

browserOutput.on("data", (chunk) => {
  readBuffer = Buffer.concat([readBuffer, chunk]);

  while (true) {
    const terminator = readBuffer.indexOf(0);

    if (terminator === -1) {
      break;
    }

    const rawMessage = readBuffer.subarray(0, terminator).toString("utf8");
    readBuffer = readBuffer.subarray(terminator + 1);

    if (!rawMessage) {
      continue;
    }

    const message = JSON.parse(rawMessage);
    const callback = pending.get(message.id);

    if (callback) {
      pending.delete(message.id);
      if (message.error) {
        callback.reject(new Error(message.error.message));
      } else {
        callback.resolve(message.result);
      }
    }
  }
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  const message = { id, method, params };

  if (sessionId) {
    message.sessionId = sessionId;
  }

  browserInput.write(`${JSON.stringify(message)}\0`);

  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

try {
  await wait(700);
  const { targetInfos } = await send("Target.getTargets");
  const pageTarget = targetInfos.find(
    (target) => target.type === "page" && target.url.includes("/scroll-demo/")
  );

  if (!pageTarget) {
    throw new Error("Could not find the scroll demo browser target.");
  }

  const { sessionId } = await send("Target.attachToTarget", {
    targetId: pageTarget.targetId,
    flatten: true
  });

  await send("Page.enable", {}, sessionId);
  await send("Runtime.enable", {}, sessionId);
  await send(
    "Emulation.setDeviceMetricsOverride",
    {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false
    },
    sessionId
  );

  for (let attempt = 0; attempt < 120; attempt++) {
    const result = await send(
      "Runtime.evaluate",
      {
        expression: "Boolean(window.__scrollDemo)",
        returnByValue: true
      },
      sessionId
    );

    if (result.result.value) {
      break;
    }

    await wait(100);
  }

  await send(
    "Runtime.evaluate",
    {
      expression: "window.__scrollDemo.stop()"
    },
    sessionId
  );

  for (let frame = 0; frame < frameCount; frame++) {
    const linearProgress = frame / (frameCount - 1);
    const easedProgress =
      linearProgress < 0.5
        ? 4 * linearProgress ** 3
        : 1 - ((-2 * linearProgress + 2) ** 3) / 2;
    const elapsedMs = (frame / fps) * 1000;

    await send(
      "Runtime.evaluate",
      {
        expression:
          `window.__scrollDemo.renderFrame(${easedProgress}, ${elapsedMs});` +
          "new Promise(requestAnimationFrame)",
        awaitPromise: true
      },
      sessionId
    );

    const screenshot = await send(
      "Page.captureScreenshot",
      {
        format: "jpeg",
        quality: 92,
        fromSurface: true,
        captureBeyondViewport: false
      },
      sessionId
    );
    const filename = path.join(
      frameDirectory,
      `frame-${String(frame).padStart(4, "0")}.jpg`
    );

    await import("node:fs/promises").then(({ writeFile }) =>
      writeFile(filename, Buffer.from(screenshot.data, "base64"))
    );
    process.stdout.write(`\rCaptured ${frame + 1}/${frameCount}`);
  }

  process.stdout.write("\n");

  await run("ffmpeg", [
    "-y",
    "-framerate",
    String(fps),
    "-i",
    path.join(frameDirectory, "frame-%04d.jpg"),
    "-filter_complex",
    "[0:v]split[forward][reverse];" +
      "[reverse]reverse,trim=start_frame=1:end_frame=89,setpts=PTS-STARTPTS[backward];" +
      "[forward][backward]concat=n=2:v=1:a=0,format=yuv420p[v]",
    "-map",
    "[v]",
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "24",
    "-movflags",
    "+faststart",
    outputPath
  ]);
} finally {
  chrome.kill("SIGTERM");
  await rm(frameDirectory, { recursive: true, force: true });
}

console.log(`Created ${outputPath}`);
