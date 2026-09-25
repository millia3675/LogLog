/* Original text layout and PNG rendering for LogLog. No RisuAI runtime dependency. */
(function (root) {
  "use strict";
  const WIDTH = 720;
  const DEFAULT = {
    background: "gradient",
    color1: "#172236",
    color2: "#46516c",
    texture: "none",
    overlay: 0.05,
    font: "ridibatang",
    fontSize: 25,
    lineHeight: 1.85,
    paragraphGap: 0.65,
    textColor: "#f4f3f0",
    align: "left",
    padding: 64,
    cornerRadius: 0,
  };
  const FONTS = {
    ridibatang: '"RIDIBatang", "Log Serif", Batang, serif',
    gowun: '"Gowun Batang", "Log Serif", Batang, serif',
    pretendard: '"Pretendard", "Log Sans", "Malgun Gothic", sans-serif',
    suit: '"SUIT", "Log Sans", "Malgun Gothic", sans-serif',
    serif: '"Log Serif", Batang, serif',
    sans: '"Log Sans", "Malgun Gothic", sans-serif',
    rounded: '"Log Rounded", sans-serif',
    mono: '"Log Mono", monospace',
  };
  const PRESETS = [
    { id: "dusk", name: "저녁의 문장", style: { ...DEFAULT } },
    {
      id: "paper",
      name: "책의 한 페이지",
      style: {
        ...DEFAULT,
        background: "solid",
        color1: "#f4f0e7",
        color2: "#f4f0e7",
        textColor: "#37342f",
        overlay: 0,
        texture: "grain",
      },
    },
    {
      id: "ink",
      name: "검은 잉크",
      style: {
        ...DEFAULT,
        background: "solid",
        color1: "#20252b",
        textColor: "#eeeeec",
        overlay: 0,
      },
    },
    {
      id: "mist",
      name: "푸른 안개",
      style: {
        ...DEFAULT,
        color1: "#dce5ec",
        color2: "#bfcfda",
        textColor: "#283e4b",
        overlay: 0,
        font: "pretendard",
      },
    },
    {
      id: "wine",
      name: "깊은 자주",
      style: {
        ...DEFAULT,
        color1: "#402a39",
        color2: "#725565",
        textColor: "#fcf0f0",
        overlay: 0,
      },
    },
    {
      id: "sky",
      name: "별이 남은 밤",
      style: {
        ...DEFAULT,
        color1: "#141d35",
        color2: "#303452",
        texture: "stars",
        overlay: 0,
      },
    },
  ];
  function normalize(input = {}) {
    const s = { ...DEFAULT };
    for (const key of ["color1", "color2", "textColor"])
      if (/^#[\da-f]{6}$/i.test(input[key])) s[key] = input[key];
    const enums = {
      background: ["solid", "gradient", "photo"],
      texture: ["none", "grain", "stars"],
      font: Object.keys(FONTS),
      align: ["left", "center"],
    };
    for (const [key, values] of Object.entries(enums))
      if (values.includes(input[key])) s[key] = input[key];
    const ranges = {
      overlay: [0, 0.85],
      fontSize: [14, 72],
      lineHeight: [1.1, 2.5],
      paragraphGap: [0, 2],
      padding: [24, 120],
      cornerRadius: [0, 120],
    };
    for (const [key, [min, max]] of Object.entries(ranges))
      if (typeof input[key] === "number" && Number.isFinite(input[key]))
        s[key] = Math.min(max, Math.max(min, input[key]));
    return s;
  }
  const segmenter =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("ko", { granularity: "grapheme" })
      : null;
  function chars(text) {
    return segmenter
      ? Array.from(segmenter.segment(text), (x) => x.segment)
      : Array.from(text);
  }
  function inline(text) {
    const result = [];
    let cursor = 0;
    // Delimiters are text syntax only: pasted HTML never executes.
    const pattern = /(\*{1,3})([^*\n]+?)\1/g;
    let match;
    while ((match = pattern.exec(text))) {
      if (match.index > cursor)
        result.push({
          text: text.slice(cursor, match.index),
          bold: false,
          italic: false,
        });
      result.push({
        text: match[2],
        bold: match[1].length >= 2,
        italic: match[1].length !== 2,
      });
      cursor = pattern.lastIndex;
    }
    if (cursor < text.length)
      result.push({ text: text.slice(cursor), bold: false, italic: false });
    return result;
  }
  function wrap(text, width, measure) {
    const units = inline(text).flatMap((run) =>
      chars(run.text).map((text) => ({ ...run, text })),
    );
    for (const unit of units) unit.width = measure(unit);
    let current = [],
      used = 0;
    const lines = [];
    function commit() {
      while (current.length && /\s/u.test(current.at(-1).text)) current.pop();
      lines.push(current);
      current = [];
      used = 0;
    }
    for (const unit of units) {
      if (current.length && used + unit.width > width) {
        let space = -1;
        for (
          let i = current.length - 1;
          i >= Math.floor(current.length * 0.45);
          i--
        )
          if (/\s/u.test(current[i].text)) {
            space = i;
            break;
          }
        if (space >= 0) {
          const rest = current.splice(space + 1);
          commit();
          current = rest;
          used = rest.reduce((n, x) => n + x.width, 0);
        } else commit();
      }
      if (!current.length && /\s/u.test(unit.text)) continue;
      current.push(unit);
      used += unit.width;
    }
    if (current.length) commit();
    return lines.length ? lines : [[]];
  }
  function font(style, unit = {}, size = style.fontSize) {
    return `${unit.italic ? "italic " : ""}${unit.bold ? "700" : "400"} ${size}px ${FONTS[style.font]}`;
  }
  function layout(text, style, metadata, mode, measure) {
    const lineH = style.fontSize * style.lineHeight,
      width = WIDTH - style.padding * 2;
    const rows = [];
    for (const paragraph of text.replace(/\r\n?/g, "\n").trim().split("\n")) {
      if (!paragraph.trim()) {
        rows.push({
          units: [],
          height: lineH * style.paragraphGap,
          blank: true,
        });
        continue;
      }
      const source = paragraph
        .replace(/^\s*>\s?(.*)$/u, "“$1”")
        .replace(/\t/g, "    ");
      const lines = wrap(source, width, (unit) =>
        measure(unit, style.fontSize),
      );
      for (const units of lines)
        rows.push({ units, height: lineH, blank: false });
    }
    const metaSize = Math.max(14, Math.round(style.fontSize * 0.57)),
      metaRows = [];
    if (metadata.enabled)
      for (const key of ["bot", "model", "free"]) {
        const field = metadata[key];
        if (field.visible && field.value.trim())
          for (const units of wrap(
            field.value.trim().replace(/\*/g, ""),
            width,
            (unit) => measure({ ...unit, bold: false }, metaSize),
          ))
            metaRows.push({ units, key });
      }
    const metaH = metaRows.length
      ? metaRows.length * metaSize * 1.75 + (metadata.divider ? 56 : 34)
      : 0;
    const pageLimit = mode === "pages" ? 1200 : 12000;
    const available = pageLimit - style.padding * 2 - metaH;
    if (available < lineH)
      throw new Error(
        "하단 정보가 너무 깁니다. 내용을 줄이거나 글자를 작게 해주세요.",
      );
    const pages = [];
    let page = [],
      height = 0;
    function commit() {
      while (page.at(-1)?.blank) {
        height -= page.pop().height;
      }
      if (page.length) {
        pages.push({
          rows: page,
          bodyHeight: height,
          height: Math.ceil(Math.max(300, style.padding * 2 + height + metaH)),
          metaRows,
          metaSize,
        });
      }
      page = [];
      height = 0;
    }
    for (const row of rows) {
      if (height + row.height > available && page.length) {
        if (mode === "long")
          throw new Error(
            "한 장의 최대 높이(12,000px)를 넘었습니다. 내보내기에서 여러 장으로 나누기를 선택해주세요.",
          );
        commit();
      }
      if (!page.length && row.blank) continue;
      page.push(row);
      height += row.height;
    }
    commit();
    if (pages.length > 80)
      throw new Error(
        "페이지가 80장을 넘었습니다. 본문을 나누어 작업해주세요.",
      );
    return pages;
  }
  function background(ctx, w, h, s, photo) {
    if (s.background === "gradient") {
      const g = ctx.createLinearGradient(0, 0, w * 0.7, h);
      g.addColorStop(0, s.color1);
      g.addColorStop(1, s.color2);
      ctx.fillStyle = g;
    } else ctx.fillStyle = s.color1;
    ctx.fillRect(0, 0, w, h);
    if (s.background === "photo" && photo) {
      const k = Math.max(w / photo.width, h / photo.height);
      ctx.drawImage(
        photo,
        (w - photo.width * k) / 2,
        (h - photo.height * k) / 2,
        photo.width * k,
        photo.height * k,
      );
    }
    let seed = 217;
    const random = () => {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    if (s.texture !== "none") {
      const count =
        s.texture === "stars"
          ? Math.ceil((w * h) / 2300)
          : Math.min(40000, Math.ceil((w * h) / 85));
      for (let i = 0; i < count; i++) {
        const x = random() * w,
          y = random() * h,
          r = random();
        ctx.fillStyle =
          s.texture === "stars"
            ? `rgba(255,255,255,${0.18 + r * 0.4})`
            : `rgba(${r > 0.5 ? "255,255,255" : "0,0,0"},.035)`;
        ctx.beginPath();
        ctx.arc(
          x,
          y,
          s.texture === "stars" ? 0.35 + r * 0.75 : 0.55,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    }
    if (s.overlay) {
      ctx.fillStyle = `rgba(0,0,0,${s.overlay})`;
      ctx.fillRect(0, 0, w, h);
    }
  }
  function paint(canvas, page, s, meta, photo, scale = 1) {
    canvas.width = WIDTH * scale;
    canvas.height = page.height * scale;
    const ctx = canvas.getContext("2d");
    ctx.scale(scale, scale);
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, WIDTH, page.height, s.cornerRadius);
    ctx.clip();
    background(ctx, WIDTH, page.height, s, photo);
    ctx.fillStyle = s.textColor;
    ctx.textBaseline = "alphabetic";
    const left = s.padding,
      contentW = WIDTH - left * 2;
    function draw(units, y, size) {
      let x = left;
      if (s.align === "center")
        x += (contentW - units.reduce((n, u) => n + u.width, 0)) / 2;
      for (const unit of units) {
        ctx.font = font(s, unit, size);
        ctx.fillText(unit.text, x, y);
        x += unit.width;
      }
    }
    let y = s.padding + s.fontSize;
    for (const row of page.rows) {
      if (!row.blank) draw(row.units, y, s.fontSize);
      y += row.height;
    }
    if (page.metaRows.length) {
      y = s.padding + page.bodyHeight;
      if (meta.divider) {
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = s.textColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(left, y + 22);
        ctx.lineTo(WIDTH - left, y + 22);
        ctx.stroke();
        y += 56;
      } else y += 34;
      ctx.globalAlpha = 0.82;
      for (const row of page.metaRows) {
        draw(row.units, y + page.metaSize, page.metaSize);
        y += page.metaSize * 1.75;
      }
      ctx.globalAlpha = 1;
    }
    ctx.restore();
    return canvas;
  }
  function replaceRules(text, rules) {
    let value = text;
    const counts = [];
    for (const rule of rules) {
      let count = 0;
      if (rule.find) {
        const escaped = rule.find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        value = value.replace(
          new RegExp(escaped, rule.caseSensitive ? "gu" : "giu"),
          () => {
            count++;
            return rule.replace;
          },
        );
      }
      counts.push(count);
    }
    return { text: value, counts, total: counts.reduce((a, b) => a + b, 0) };
  }
  // A small uncompressed ZIP writer avoids third-party code and repeated download prompts.
  function zip(files) {
    const encoder = new TextEncoder();
    const parts = [],
      directory = [];
    let offset = 0;
    function header(length) {
      const bytes = new Uint8Array(length);
      return { bytes, view: new DataView(bytes.buffer) };
    }
    function crc32(bytes) {
      let crc = -1;
      for (const byte of bytes) {
        crc ^= byte;
        for (let j = 0; j < 8; j++)
          crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
      }
      return (crc ^ -1) >>> 0;
    }
    for (const file of files) {
      const name = encoder.encode(file.name),
        data = file.data,
        crc = crc32(data);
      const local = header(30);
      local.view.setUint32(0, 0x04034b50, true);
      local.view.setUint16(4, 20, true);
      local.view.setUint16(6, 0x800, true);
      local.view.setUint16(12, 33, true);
      local.view.setUint32(14, crc, true);
      local.view.setUint32(18, data.length, true);
      local.view.setUint32(22, data.length, true);
      local.view.setUint16(26, name.length, true);
      parts.push(local.bytes, name, data);
      const central = header(46);
      central.view.setUint32(0, 0x02014b50, true);
      central.view.setUint16(4, 20, true);
      central.view.setUint16(6, 20, true);
      central.view.setUint16(8, 0x800, true);
      central.view.setUint16(14, 33, true);
      central.view.setUint32(16, crc, true);
      central.view.setUint32(20, data.length, true);
      central.view.setUint32(24, data.length, true);
      central.view.setUint16(28, name.length, true);
      central.view.setUint32(42, offset, true);
      directory.push(central.bytes, name);
      offset += 30 + name.length + data.length;
    }
    const end = header(22),
      size = directory.reduce((sum, x) => sum + x.length, 0);
    end.view.setUint32(0, 0x06054b50, true);
    end.view.setUint16(8, files.length, true);
    end.view.setUint16(10, files.length, true);
    end.view.setUint32(12, size, true);
    end.view.setUint32(16, offset, true);
    return new Blob([...parts, ...directory, end.bytes], {
      type: "application/zip",
    });
  }
  const api = {
    WIDTH,
    DEFAULT,
    FONTS,
    PRESETS,
    normalize,
    chars,
    inline,
    wrap,
    font,
    layout,
    background,
    paint,
    replaceRules,
    zip,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.LogEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
