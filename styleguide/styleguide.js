const root = document.documentElement;
const controlList = document.getElementById("token-controls");
const copyButton = document.getElementById("copy-tokens");
const resetButton = document.getElementById("reset-tokens");
const toggleButton = document.getElementById("toggle-editor");
const tokenEditor = document.querySelector(".token-editor");
const copyStatus = document.getElementById("copy-status");

const controls = [
  { property: "--color-forest", label: "Forest", type: "color" },
  { property: "--color-plum", label: "Plum", type: "color" },
  { property: "--color-yellow", label: "Yellow", type: "color" },
  { property: "--color-brown", label: "Brown", type: "color" },
  { property: "--color-cream", label: "Cream", type: "color" },
  { property: "--color-cyan", label: "Cyan", type: "color" },
  { property: "--color-pink", label: "Pink", type: "color" },
  { property: "--color-orange", label: "Orange", type: "color" },
  { property: "--type-display-xl", label: "Display XL", min: 52, max: 112, step: 1, unit: "px" },
  { property: "--type-display", label: "Display", min: 38, max: 80, step: 1, unit: "px" },
  { property: "--type-h1", label: "H1", min: 30, max: 64, step: 1, unit: "px" },
  { property: "--type-body", label: "Body", min: 14, max: 20, step: 1, unit: "px" },
  { property: "--page-gutter", label: "Page gutter", min: 20, max: 96, step: 2, unit: "px" },
  { property: "--glass-opacity", label: "Glass opacity", min: 0.04, max: 0.4, step: 0.01, unit: "" },
  { property: "--glass-blur", label: "Glass blur", min: 0, max: 40, step: 1, unit: "px" },
  { property: "--shadow-offset", label: "Shadow offset", min: 0, max: 24, step: 1, unit: "px" }
];

const defaults = Object.fromEntries(
  controls.map((control) => [
    control.property,
    getComputedStyle(root).getPropertyValue(control.property).trim()
  ])
);

function numericValue(value) {
  return Number.parseFloat(value);
}

function formatValue(control, value) {
  if (control.type === "color") {
    return value.toUpperCase();
  }

  const precision = control.step < 1 ? 2 : 0;
  return `${Number(value).toFixed(precision)}${control.unit}`;
}

function buildControls() {
  for (const control of controls) {
    const row = document.createElement("label");
    const input = document.createElement("input");
    const output = document.createElement("output");
    const defaultValue = defaults[control.property];

    row.className = "token-control";
    row.append(document.createTextNode(control.label));

    if (control.type === "color") {
      input.type = "color";
      input.value = defaultValue;
    } else {
      input.type = "range";
      input.min = control.min;
      input.max = control.max;
      input.step = control.step;
      input.value = numericValue(defaultValue);
    }

    output.value = formatValue(control, input.value);
    input.addEventListener("input", () => {
      const nextValue =
        control.type === "color" ? input.value : `${input.value}${control.unit}`;

      root.style.setProperty(control.property, nextValue);
      output.value = formatValue(control, input.value);
      copyStatus.value = "";
    });

    row.append(input, output);
    controlList.append(row);
  }
}

function serializeTokens() {
  const values = controls.map((control) => {
    const value =
      root.style.getPropertyValue(control.property).trim() ||
      defaults[control.property];

    return `  ${control.property}: ${value};`;
  });

  return `:root {\n${values.join("\n")}\n}`;
}

async function copyTokens() {
  try {
    await navigator.clipboard.writeText(serializeTokens());
    copyStatus.value = "CSS token overrides copied.";
  } catch (error) {
    copyStatus.value = `Copy failed: ${error.message}`;
  }
}

function resetTokens() {
  controls.forEach((control, index) => {
    root.style.removeProperty(control.property);
    const input = controlList.children[index].querySelector("input");
    const output = controlList.children[index].querySelector("output");

    input.value =
      control.type === "color"
        ? defaults[control.property]
        : numericValue(defaults[control.property]);
    output.value = formatValue(control, input.value);
  });
  copyStatus.value = "Tokens reset.";
}

function toggleEditor() {
  const isCollapsed = tokenEditor.classList.toggle("is-collapsed");

  toggleButton.textContent = isCollapsed ? "+" : "−";
  toggleButton.title = isCollapsed ? "Expand editor" : "Collapse editor";
  toggleButton.setAttribute(
    "aria-label",
    isCollapsed ? "Expand editor" : "Collapse editor"
  );
}

buildControls();
copyButton.addEventListener("click", copyTokens);
resetButton.addEventListener("click", resetTokens);
toggleButton.addEventListener("click", toggleEditor);
