import { InterfacePalette } from "../object/InterfacePalette.js";
import { UI_COLOR } from "../property/UI_COLOR.js";

/**
 * The visible controls reuse ClusterOpt's original palette modal.
 * The UI never writes EDPMU directly; requests go through HubUnit.
 */
export function mountPaletteUI(core, doc = document, storage = null) {
  const palette = new InterfacePalette(core, {
    storage, target: doc.documentElement
  });
  const byId = id => doc.getElementById(id);
  const dialog = byId("paletteDialog");
  const options = byId("toolOptions");
  const toggle = byId("toolBtn");
  const channels = [...doc.querySelectorAll("[data-rgb]")];

  function render(state) {
    byId("palettePicker").value = state.hex;
    byId("paletteHex").textContent = state.hex;
    byId("paletteMode").textContent = state.mode.toUpperCase();
    channels.forEach((input, index) => {
      input.value = String(state.rgb[index]);
    });
  }

  async function send(action, payload = {}) {
    const result = await core.request("ui", "InterfacePalette",
      action, payload, { origin: "user" });
    if (result.ok) render(result.value);
    else {
      const message = "介面調色盤：" + (result.error ?? "請求失敗");
      byId("paletteHint").textContent = message;
    }
    return result;
  }

  toggle.addEventListener("click", event => {
    event.stopPropagation();
    options.hidden = !options.hidden;
    toggle.setAttribute("aria-expanded", String(!options.hidden));
  });
  byId("paletteBtn").addEventListener("click", async event => {
    event.stopPropagation();
    options.hidden = true;
    toggle.setAttribute("aria-expanded", "false");
    byId("menu").hidden = true;
    byId("menuBtn").setAttribute("aria-expanded", "false");
    const result = await send("get");
    if (result.ok) dialog.showModal();
  });

  byId("paletteClose").addEventListener("click", () => dialog.close());
  byId("paletteDone").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", event => {
    if (event.target === dialog) dialog.close();
  });

  byId("palettePicker").addEventListener("input", event => {
    void send("set", { rgb: UI_COLOR.fromHex(event.target.value) });
  });
  for (const input of channels) {
    input.addEventListener("change", () => {
      const rgb = channels.map(element => Number(element.value));
      void send("set", { rgb });
    });
  }
  byId("paletteDark").addEventListener("click", () => {
    void send("set", { rgb: [0, 0, 0] });
  });
  byId("paletteLight").addEventListener("click", () => {
    void send("set", { rgb: [255, 255, 255] });
  });

  // The stored setting has already been published by the Palette Object.
  render(palette.snapshot());
  return palette;
}
