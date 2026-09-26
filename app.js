(function () {
  "use strict";
  const E = window.LogEngine,
    $ = (id) => document.getElementById(id);
  const DEMO =
    "“돌아오지 않을 줄 알았어.”\n\n그는 대답 대신 젖은 우산을 접었다. 문틈으로 들어온 저녁 바람이 탁자 위의 책장을 조용히 넘겼다. 마지막으로 만났던 날에도, 우리는 같은 페이지를 읽고 있었다.\n\n“아직 돌려주지 못한 이야기가 있어서.”\n\n나는 그제야 빈 의자를 당겼다. 오래 기다린 말들은 이상하게도, 입 밖으로 꺼내는 순간 가장 평범한 인사가 되었다.";
  const KEY = "loglog.styles.v1";
  const FONT_INFO = {
    ridibatang: {
      description:
        "긴 문장을 읽기 편한 전자책용 바탕체. 굵게는 브라우저가 표현합니다.",
      source: "https://noonnu.cc/font_page/324",
    },
    gowun: {
      description: "부드러운 획의 바탕체. 차분한 서술과 대사에 어울려요.",
      source: "https://noonnu.cc/font_page/733",
    },
    pretendard: {
      description: "단정한 고딕체. 한글과 영문이 섞인 대화에 추천해요.",
      source: "https://noonnu.cc/font_page/694",
    },
    suit: {
      description: "간결한 고딕체. 숫자와 문장부호가 많은 대화에 어울려요.",
      source: "https://noonnu.cc/font_page/845",
    },
    serif: { description: "기존의 정갈한 명조체입니다." },
    sans: { description: "기존의 기본 고딕체입니다." },
    rounded: { description: "둥근 글꼴로 짧고 경쾌한 문장에 어울려요." },
    mono: { description: "모든 글자의 폭이 일정한 글꼴입니다." },
  };
  let state = { style: { ...E.DEFAULT }, presets: [] },
    photo = null,
    photoVersion = 0,
    pages = [],
    pageIndex = 0,
    undoText = null,
    renderError = null,
    renderTimer,
    renderVersion = 0,
    noticeTimer,
    busy = false;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "null");
    if (saved?.version === 1) {
      state.style = E.normalize(saved.style);
      if (state.style.background === "photo")
        state.style.background = "gradient";
      state.presets = validPresets(saved.presets);
    }
  } catch {}
  function validPresets(items) {
    return Array.isArray(items)
      ? items
          .slice(0, 100)
          .filter(
            (p) =>
              p &&
              typeof p.name === "string" &&
              p.name.trim() &&
              p.style &&
              typeof p.style === "object",
          )
          .map((p) => ({
            id: crypto.randomUUID(),
            name: p.name.trim().slice(0, 40),
            style: E.normalize(p.style),
          }))
      : [];
  }
  function notify(message) {
    clearTimeout(noticeTimer);
    $("notice").textContent = message;
    $("notice").hidden = false;
    noticeTimer = setTimeout(() => ($("notice").hidden = true), 4200);
  }
  function persist() {
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({
          version: 1,
          style: state.style,
          presets: state.presets,
        }),
      );
    } catch {
      notify(
        "브라우저에 설정을 저장하지 못했습니다. 내 스타일을 파일로 내보내주세요.",
      );
    }
  }
  function metadata() {
    const m = {
      enabled: $("metadata-on").checked,
      divider: $("divider").checked,
    };
    for (const key of ["bot", "model", "free"])
      m[key] = {
        value: $("meta-" + key).value,
        visible: $("show-" + key).checked,
      };
    return m;
  }
  function setText(text) {
    $("body-text").value = text;
    undoText = null;
    $("undo-replace").disabled = true;
    schedule();
  }
  const sliders = [
    ["fontSize", "글자 크기", 14, 72, 1, "px"],
    ["lineHeight", "줄 간격", 1.1, 2.5, 0.05, "배"],
    ["paragraphGap", "빈 줄 간격", 0, 2, 0.05, "배"],
    ["padding", "안쪽 여백", 24, 120, 2, "px"],
    ["cornerRadius", "모서리 둥글기", 0, 120, 2, "px"],
  ];
  for (const [key, label, min, max, step, unit] of sliders) {
    const row = document.createElement("div");
    row.className = "slider-row";
    row.innerHTML = `<div class="slider-head"><label for="${key}">${label}</label><span><input id="${key}-number" type="number" min="${min}" max="${max}" step="${step}" aria-label="${label} 직접 입력"> ${unit}</span></div><input id="${key}" data-style="${key}" type="range" min="${min}" max="${max}" step="${step}">`;
    $("sliders").append(row);
    $(key + "-number").addEventListener("input", () => {
      const n = $(key + "-number").valueAsNumber;
      if (!Number.isFinite(n)) return;
      state.style = E.normalize({ ...state.style, [key]: n });
      $(key).value = state.style[key];
      persist();
      schedule();
    });
    $(key + "-number").addEventListener(
      "change",
      () => ($(key + "-number").value = state.style[key]),
    );
  }
  function sync() {
    const info = FONT_INFO[state.style.font];
    $("font-description").textContent = info.description;
    $("font-source").hidden = !info.source;
    if (info.source) $("font-source").href = info.source;
    else $("font-source").removeAttribute("href");
    document.querySelectorAll("[data-style]").forEach((input) => {
      if (input.type === "checkbox")
        input.checked = state.style[input.dataset.style];
      else input.value = state.style[input.dataset.style];
    });
    $("dialogueColor").disabled = !state.style.dialogueHighlight;
    for (const [key] of sliders) $(key + "-number").value = state.style[key];
    document
      .querySelectorAll('[name="align"]')
      .forEach((input) => (input.checked = input.value === state.style.align));
    $("overlay-value").textContent =
      Math.round(state.style.overlay * 100) + "%";
    $("end-color").hidden = state.style.background !== "gradient";
    $("colors").hidden = state.style.background === "photo";
    drawPresetButtons();
  }
  function drawPresetButtons() {
    for (const button of $("presets").children) {
      const preset = E.PRESETS.find((p) => p.id === button.dataset.id);
      button.setAttribute(
        "aria-pressed",
        String(
          JSON.stringify(E.normalize(preset.style)) ===
            JSON.stringify(state.style),
        ),
      );
    }
  }
  for (const preset of E.PRESETS) {
    const button = document.createElement("button");
    button.className = "preset";
    button.dataset.id = preset.id;
    button.setAttribute("aria-pressed", "false");
    const canvas = document.createElement("canvas");
    canvas.width = 180;
    canvas.height = 105;
    canvas.setAttribute("aria-hidden", "true");
    const ctx = canvas.getContext("2d");
    E.background(ctx, 180, 105, preset.style, null);
    ctx.fillStyle = preset.style.textColor;
    ctx.font = "22px serif";
    ctx.fillText("Aa", 18, 42);
    ctx.globalAlpha = 0.5;
    ctx.fillRect(19, 60, 98, 1);
    ctx.fillRect(19, 69, 77, 1);
    const label = document.createElement("span");
    label.textContent = preset.name;
    button.append(canvas, label);
    button.addEventListener("click", () => {
      state.style = E.normalize(preset.style);
      sync();
      persist();
      schedule();
    });
    $("presets").append(button);
  }
  const fontPromises = new Map();
  async function ensureFonts(key) {
    if (!fontPromises.has(key)) {
      // Load the bundled fallback too: SUIT's compact Hangul set does not
      // contain every syllable. Both preview and PNG must measure ready faces.
      const families = E.FONTS[key]
        .match(/"[^"]+"/g)
        .filter((family) => family !== '"Malgun Gothic"');
      fontPromises.set(
        key,
        Promise.all(
          families.flatMap((family) => {
            const weights =
              family === '"RIDIBatang"' || family === '"Log Rounded"'
                ? [400]
                : [400, 700];
            return weights.map(async (weight) => {
              const faces = await document.fonts.load(
                `${weight} 25px ${family}`,
                "한글 가나 ABC",
              );
              if (!faces.length)
                throw new Error(
                  "글꼴을 불러오지 못했습니다. 새로고침하거나 다른 글꼴을 선택해주세요.",
                );
              return faces;
            });
          }),
        ).catch((error) => {
          fontPromises.delete(key);
          throw error;
        }),
      );
    }
    return fontPromises.get(key);
  }
  function schedule() {
    clearTimeout(renderTimer);
    renderVersion++;
    $("download").disabled = true;
    $("download-all").disabled = true;
    $("share").disabled = true;
    renderTimer = setTimeout(render, 100);
  }
  function updateButtons() {
    $("download").disabled = busy || !!renderError || !pages.length;
    $("download-all").disabled = $("download").disabled;
    $("share").disabled = $("download").disabled;
  }
  function showPage() {
    if (!pages.length) return;
    pageIndex = Math.min(pageIndex, pages.length - 1);
    E.paint($("preview"), pages[pageIndex], state.style, metadata(), photo, 1);
    $("preview").setAttribute(
      "aria-label",
      `이미지 미리보기 ${pageIndex + 1} / ${pages.length}페이지`,
    );
    const scale = Number($("scale").value);
    $("dimensions").textContent =
      `${E.WIDTH * scale} × ${pages[pageIndex].height * scale} px`;
    $("pagination").hidden = pages.length < 2;
    $("page-info").textContent = `${pageIndex + 1} / ${pages.length}`;
    $("previous").disabled = pageIndex === 0;
    $("next").disabled = pageIndex === pages.length - 1;
    $("download").querySelector("span").textContent =
      pages.length > 1 ? "현재 장 저장" : "PNG 저장";
    $("download-all").textContent =
      pages.length > 1 ? `${pages.length}장 ZIP으로 저장` : "PNG 이미지 저장";
  }
  async function render() {
    clearTimeout(renderTimer);
    const version = ++renderVersion;
    const text = $("body-text").value;
    $("char-count").textContent = `${E.chars(text).length.toLocaleString()}자`;
    $("preview-note").textContent =
      text === DEMO
        ? "예시 문장 · 본문을 바꿔 나만의 장면을 만들어보세요."
        : "줄바꿈과 여백이 저장할 이미지에 그대로 반영됩니다.";
    if (!text.trim()) {
      pages = [];
      renderError = null;
      $("preview").hidden = true;
      $("empty-state").hidden = false;
      $("empty-state").querySelector("h2").textContent =
        "어떤 장면을 남길까요?";
      $("empty-state").querySelector("p").textContent =
        "본문에 대화를 붙여넣으면 이곳에서 바로 확인할 수 있어요.";
      $("dimensions").textContent = "본문을 입력해주세요";
      $("pagination").hidden = true;
      updateButtons();
      return;
    }
    $("preview").hidden = false;
    $("empty-state").hidden = true;
    try {
      await ensureFonts(state.style.font);
      if (version !== renderVersion) return;
      const measure = document.createElement("canvas").getContext("2d");
      pages = E.layout(
        text,
        state.style,
        metadata(),
        $("output-mode").value,
        (unit, size) => {
          measure.font = E.font(state.style, unit, size);
          return measure.measureText(unit.text).width;
        },
      );
      renderError = null;
      showPage();
    } catch (error) {
      if (version !== renderVersion) return;
      renderError = error.message;
      pages = [];
      $("preview").hidden = true;
      $("empty-state").hidden = false;
      $("empty-state").querySelector("h2").textContent =
        "미리보기를 만들지 못했어요";
      $("empty-state").querySelector("p").textContent = error.message;
      $("dimensions").textContent = "설정을 확인해주세요";
      $("pagination").hidden = true;
    }
    if (!renderError) {
      $("empty-state").querySelector("h2").textContent =
        "어떤 장면을 남길까요?";
      $("empty-state").querySelector("p").textContent =
        "본문에 대화를 붙여넣으면 이곳에서 바로 확인할 수 있어요.";
    }
    updateButtons();
  }
  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function png(canvas) {
    return new Promise((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new Error(
                  "이미지가 너무 큽니다. 기본 해상도나 여러 장 나누기를 선택해주세요.",
                ),
              ),
        "image/png",
      ),
    );
  }
  function filename(index) {
    return `LogLog-${new Date().toISOString().slice(0, 10)}-${String(index + 1).padStart(2, "0")}.png`;
  }
  async function output(all = false, share = false) {
    if (busy) return;
    busy = true;
    updateButtons();
    try {
      await render();
      if (renderError || !pages.length)
        throw new Error(renderError || "먼저 본문을 입력해주세요.");
      const chosen = all ? pages : [pages[pageIndex]],
        scale = Number($("scale").value),
        style = { ...state.style },
        meta = metadata(),
        image = photo;
      const blobs = [];
      $("download").querySelector("span").textContent = "저장 준비 중…";
      for (let i = 0; i < chosen.length; i++) {
        const canvas = document.createElement("canvas");
        E.paint(canvas, chosen[i], style, meta, image, scale);
        const blob = await png(canvas);
        blobs.push({ blob, name: filename(all ? i : pageIndex) });
        canvas.width = canvas.height = 1;
      }
      if (share && blobs.length === 1) {
        const file = new File([blobs[0].blob], blobs[0].name, {
          type: "image/png",
        });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file] });
          return;
        }
      }
      if (blobs.length === 1) download(blobs[0].blob, blobs[0].name);
      else {
        const files = [];
        for (const item of blobs)
          files.push({
            name: item.name,
            data: new Uint8Array(await item.blob.arrayBuffer()),
          });
        download(
          E.zip(files),
          `LogLog-${new Date().toISOString().slice(0, 10)}.zip`,
        );
      }
      notify(
        blobs.length > 1
          ? "모든 페이지를 ZIP 파일로 저장했습니다."
          : "PNG 이미지를 저장했습니다.",
      );
    } catch (error) {
      if (error.name !== "AbortError")
        notify(error.message || "이미지를 저장하지 못했습니다.");
    } finally {
      busy = false;
      if (pages.length) showPage();
      updateButtons();
    }
  }
  $("download").addEventListener("click", () => output());
  $("download-all").addEventListener("click", () => output(true));
  if (navigator.share) {
    $("share").hidden = false;
    $("share").addEventListener("click", () => output(false, true));
  }
  $("previous").addEventListener("click", () => {
    pageIndex--;
    showPage();
  });
  $("next").addEventListener("click", () => {
    pageIndex++;
    showPage();
  });
  $("expand").addEventListener("click", () => {
    if (!pages.length) return notify("먼저 본문을 입력해주세요.");
    const canvas = document.createElement("canvas");
    E.paint(canvas, pages[pageIndex], state.style, metadata(), photo, 1);
    $("full-canvas").replaceChildren(canvas);
    $("full-preview").showModal();
  });
  $("close-preview").addEventListener("click", () => $("full-preview").close());
  $("full-preview").addEventListener("click", (event) => {
    if (event.target === $("full-preview")) $("full-preview").close();
  });
  const tabs = ["content", "design", "export"];
  function selectTab(key) {
    for (const t of tabs) {
      $("tab-" + t).setAttribute("aria-selected", String(key === t));
      $("tab-" + t).tabIndex = key === t ? 0 : -1;
      $("panel-" + t).hidden = key !== t;
    }
  }
  for (const [index, key] of tabs.entries()) {
    $("tab-" + key).addEventListener("click", () => selectTab(key));
    $("tab-" + key).addEventListener("keydown", (event) => {
      let next;
      if (event.key === "ArrowRight") next = tabs[(index + 1) % 3];
      else if (event.key === "ArrowLeft") next = tabs[(index + 2) % 3];
      else if (event.key === "Home") next = tabs[0];
      else if (event.key === "End") next = tabs[2];
      if (next) {
        event.preventDefault();
        selectTab(next);
        $("tab-" + next).focus();
      }
    });
  }
  $("body-text").addEventListener("input", () => {
    undoText = null;
    $("undo-replace").disabled = true;
    schedule();
  });
  $("clear-text").addEventListener("click", () => {
    if (!$("body-text").value) return;
    const previous = $("body-text").value;
    setText("");
    undoText = previous;
    $("undo-replace").disabled = false;
    $("body-text").focus();
    notify("본문을 비웠습니다. 찾기 · 바꾸기의 되돌리기로 복구할 수 있어요.");
  });
  $("restore-demo").addEventListener("click", () => {
    if (
      $("body-text").value &&
      $("body-text").value !== DEMO &&
      !confirm("작성 중인 본문을 예시 문장으로 바꿀까요?")
    )
      return;
    setText(DEMO);
  });
  document.querySelectorAll("[data-format]").forEach((button) =>
    button.addEventListener("click", () => {
      const input = $("body-text"),
        start = input.selectionStart,
        end = input.selectionEnd,
        mark = button.dataset.format;
      if (start === end)
        return notify("먼저 서식을 적용할 문장을 선택해주세요.");
      const selected = input.value.slice(start, end),
        replacement =
          mark === "> "
            ? selected
                .split("\n")
                .map((line) => "> " + line)
                .join("\n")
            : mark + selected + mark;
      input.setRangeText(replacement, start, end, "select");
      input.focus();
      undoText = null;
      $("undo-replace").disabled = true;
      schedule();
    }),
  );
  [
    "metadata-on",
    "divider",
    "meta-bot",
    "meta-model",
    "meta-free",
    "show-bot",
    "show-model",
    "show-free",
  ].forEach((id) => $(id).addEventListener("input", schedule));
  document.querySelectorAll("[data-style]").forEach((input) =>
    input.addEventListener("input", () => {
      const key = input.dataset.style;
      let value =
        input.type === "checkbox"
          ? input.checked
          : input.type === "range"
            ? Number(input.value)
            : input.value;
      if (key === "background" && value === "photo" && !photo) {
        input.value = state.style.background;
        $("photo").click();
        return;
      }
      state.style = E.normalize({ ...state.style, [key]: value });
      sync();
      persist();
      schedule();
    }),
  );
  document.querySelectorAll('[name="align"]').forEach((input) =>
    input.addEventListener("change", () => {
      state.style.align = input.value;
      persist();
      schedule();
    }),
  );
  $("reset-style").addEventListener("click", () => {
    state.style = { ...E.DEFAULT };
    sync();
    persist();
    schedule();
  });
  $("output-mode").addEventListener("change", () => {
    pageIndex = 0;
    schedule();
  });
  $("scale").addEventListener("change", () => {
    if (pages.length) showPage();
  });
  $("photo").addEventListener("change", async () => {
    const file = $("photo").files[0];
    $("photo").value = "";
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
      return notify("PNG, JPG, WebP 사진을 선택해주세요.");
    if (file.size > 20 * 1024 * 1024)
      return notify("사진은 20MB 이하로 선택해주세요.");
    const version = ++photoVersion,
      url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== photoVersion) return;
      photo = image;
      state.style.background = "photo";
      $("photo-name").textContent = file.name;
      $("remove-photo").hidden = false;
      sync();
      persist();
      schedule();
    } catch {
      notify("사진을 읽지 못했습니다. 다른 파일을 선택해주세요.");
    } finally {
      URL.revokeObjectURL(url);
    }
  });
  $("remove-photo").addEventListener("click", () => {
    photoVersion++;
    photo = null;
    if (state.style.background === "photo") state.style.background = "gradient";
    $("photo-name").textContent = "PNG, JPG, WebP · 최대 20MB";
    $("remove-photo").hidden = true;
    sync();
    persist();
    schedule();
  });
  let ruleSequence = 0;
  function addRule() {
    const id = ++ruleSequence,
      row = document.createElement("div");
    row.className = "rule";
    row.innerHTML = `<div class="rule-inputs"><input type="text" class="find" placeholder="찾을 말" aria-label="규칙 ${id} 찾을 말"><input type="text" class="replacement" placeholder="바꿀 말" aria-label="규칙 ${id} 바꿀 말"><button aria-label="규칙 ${id} 삭제">×</button></div><label class="check"><input type="checkbox">대소문자 구분</label>`;
    row.querySelector("button").addEventListener("click", () => row.remove());
    $("rules").append(row);
  }
  $("add-rule").addEventListener("click", () => {
    if ($("rules").children.length >= 30)
      return notify("치환 규칙은 30개까지 추가할 수 있어요.");
    addRule();
  });
  $("replace").addEventListener("click", () => {
    const rules = Array.from($("rules").children).map((row) => ({
      find: row.querySelector(".find").value,
      replace: row.querySelector(".replacement").value,
      caseSensitive: row.querySelector('[type="checkbox"]').checked,
    }));
    const before = $("body-text").value,
      result = E.replaceRules(before, rules);
    if (result.text.length > 60000)
      return notify("치환 결과가 60,000자를 넘습니다. 규칙을 줄여주세요.");
    if (result.total) {
      undoText = before;
      $("body-text").value = result.text;
      $("undo-replace").disabled = false;
      schedule();
    }
    $("replace-result").textContent =
      `${result.total}곳을 바꿨습니다. ${result.counts.map((n, i) => `규칙 ${i + 1}: ${n}곳`).join(" / ")}`;
  });
  $("undo-replace").addEventListener("click", () => {
    if (undoText === null) return;
    $("body-text").value = undoText;
    undoText = null;
    $("undo-replace").disabled = true;
    $("replace-result").textContent = "이전 본문으로 되돌렸습니다.";
    schedule();
  });
  function uniqueName(name, exclude) {
    return !state.presets.some(
      (p) =>
        p.id !== exclude &&
        p.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
    );
  }
  function drawUserPresets() {
    $("user-presets").replaceChildren();
    for (const preset of state.presets) {
      const row = document.createElement("div");
      row.className = "user-style";
      const input = document.createElement("input");
      input.type = "text";
      input.value = preset.name;
      input.maxLength = 40;
      input.setAttribute("aria-label", `${preset.name} 스타일 이름`);
      input.addEventListener("change", () => {
        const name = input.value.trim();
        if (!name || !uniqueName(name, preset.id)) {
          input.value = preset.name;
          return notify("비어 있지 않은 다른 이름을 입력해주세요.");
        }
        preset.name = name;
        persist();
      });
      const use = document.createElement("button");
      use.textContent = "적용";
      use.setAttribute("aria-label", `${preset.name} 적용`);
      use.addEventListener("click", () => {
        state.style = E.normalize(preset.style);
        if (state.style.background === "photo" && !photo)
          state.style.background = "gradient";
        sync();
        persist();
        schedule();
      });
      const remove = document.createElement("button");
      remove.textContent = "삭제";
      remove.setAttribute("aria-label", `${preset.name} 삭제`);
      remove.addEventListener("click", () => {
        state.presets = state.presets.filter((p) => p.id !== preset.id);
        persist();
        drawUserPresets();
      });
      row.append(input, use, remove);
      $("user-presets").append(row);
    }
  }
  $("save-preset").addEventListener("click", () => {
    const name = $("preset-name").value.trim();
    if (!name) return notify("스타일 이름을 입력해주세요.");
    if (!uniqueName(name)) return notify("이미 같은 이름의 스타일이 있어요.");
    if (state.presets.length >= 100)
      return notify("내 스타일은 100개까지 저장할 수 있어요.");
    const style = { ...state.style };
    if (style.background === "photo") style.background = "gradient";
    state.presets.push({ id: crypto.randomUUID(), name, style });
    $("preset-name").value = "";
    persist();
    drawUserPresets();
    notify("내 스타일에 저장했습니다.");
  });
  $("export-presets").addEventListener("click", () => {
    if (!state.presets.length) return notify("먼저 내 스타일을 저장해주세요.");
    download(
      new Blob(
        [
          JSON.stringify(
            {
              format: "loglog-styles",
              version: 1,
              presets: state.presets.map(({ name, style }) => ({
                name,
                style,
              })),
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
      "LogLog-styles.json",
    );
  });
  $("import-presets").addEventListener("click", () => $("preset-file").click());
  $("preset-file").addEventListener("change", async () => {
    const file = $("preset-file").files[0];
    $("preset-file").value = "";
    if (!file) return;
    if (file.size > 1024 * 1024)
      return notify("스타일 파일은 1MB 이하로 선택해주세요.");
    try {
      const value = JSON.parse(await file.text());
      if (
        value.format !== "loglog-styles" ||
        value.version !== 1 ||
        !Array.isArray(value.presets)
      )
        throw new Error("LogLog 스타일 JSON 파일을 선택해주세요.");
      let imported = 0;
      for (const p of validPresets(value.presets)) {
        if (state.presets.length >= 100) break;
        const base = p.name;
        let n = 2;
        while (!uniqueName(p.name)) p.name = base.slice(0, 32) + ` (${n++})`;
        state.presets.push(p);
        imported++;
      }
      persist();
      drawUserPresets();
      notify(`${imported}개 스타일을 가져왔습니다.`);
    } catch (error) {
      notify(
        error instanceof SyntaxError
          ? "JSON 파일을 읽지 못했습니다. 파일 형식을 확인해주세요."
          : error.message,
      );
    }
  });
  window.addEventListener("beforeunload", (event) => {
    if ($("body-text").value && $("body-text").value !== DEMO) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  $("body-text").value = DEMO;
  addRule();
  sync();
  drawUserPresets();
  render();
})();
