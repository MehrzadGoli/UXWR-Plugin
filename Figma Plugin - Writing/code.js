// code.js

const componentLayerNames = {
  button: ["btn__label"],
  chip: ["chip__label"],
  input: ["input__label", "input__hint", "input__placeholder"],
  error: ["input__error"],
  switch: ["switch__label"],
  checkbox: ["checkbox__label"],
  radio: ["radio__label"],
  paragraph: ["paragraph__text", "body__text", "desc__text"],
  title: ["title__text", "section__title"],
  hint: ["hint__title", "hint__body"]
};

const replacements = {
  "باذگشت": "بازگشت",
  "پرداحت": "پرداخت",
  "جابما": "جاباما"
};

const allowedSingleWordButtons = ["پرداخت"];

async function checkTextWithLanguageTool(text) {
  const body = `language=fa&text=${encodeURIComponent(text)}`;

  const response = await fetch("https://api.languagetool.org/v2/check", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  const data = await response.json();

  let updatedText = text;
  data.matches.forEach(match => {
    if (match.replacements.length > 0) {
      const replacement = match.replacements[0].value;
      updatedText = updatedText.substring(0, match.offset) +
                    replacement +
                    updatedText.substring(match.offset + match.length);
    }
  });

  return updatedText;
}

async function runPlugin() {
  if (figma.currentPage.selection.length === 0) {
    figma.notify("هیچ فریمی انتخاب نشده است.");
    figma.closePlugin();
    return;
  }

  const selected = figma.currentPage.selection[0];
  const textNodes = [];

  function findTextNodes(node) {
    if (node.type === "TEXT") textNodes.push(node);
    if ("children" in node) node.children.forEach(findTextNodes);
  }

  findTextNodes(selected);

  for (const node of textNodes) {
    const layerName = node.name;
    console.log("📍 بررسی لایه:", layerName);
    let category = null;

    try {
      const style = figma.getStyleById(node.textStyleId);
      if (style) {
        const styleName = style.name.toLowerCase();
        if (styleName.startsWith("label/")) category = "label";
        else if (styleName.startsWith("paragraph/")) category = "paragraph";
        else if (styleName.startsWith("heading/")) category = "title";
      }
    } catch (e) {}

    if (!category) {
      for (const key in componentLayerNames) {
        for (const namePattern of componentLayerNames[key]) {
          if (layerName.includes(namePattern)) {
            category = key;
            break;
          }
        }
        if (category) break;
      }
    }

    if (!category) continue;

    let originalText = node.characters;
    let updatedText = originalText;
    let commentLog = [];

    if (["paragraph"].includes(category)) {
      if (!updatedText.trim().endsWith(".")) {
        updatedText += ".";
        commentLog.push("افزودن نقطه انتهایی برای پاراگراف.");
      }
    } else {
      if (updatedText.includes(".")) {
        updatedText = updatedText.replaceAll(".", "");
        commentLog.push("حذف نقطه از متن غیرپاراگرافی.");
      }
    }

    for (const wrong in replacements) {
      if (updatedText.includes(wrong)) {
        updatedText = updatedText.replaceAll(wrong, replacements[wrong]);
        commentLog.push(`اصلاح: «${wrong}» → «${replacements[wrong]}»`);
      }
    }

    const isButtonLayer = componentLayerNames.button.includes(layerName);
    console.log("📌 دکمه تشخیص داده شد؟", isButtonLayer, "→", layerName);

    if (isButtonLayer) {
      const words = updatedText.trim().split(/\s+/);
      const wordCount = words.length;
      console.log("🔤 کلمات دکمه:", words);

      if (wordCount > 3) {
        commentLog.push(`⛔️ دکمه بیشتر از ۳ کلمه دارد (${wordCount} کلمه).`);
      }

      if (words.includes("کن")) {
        commentLog.push("⛔️ استفاده از «کن» در دکمه مجاز نیست.");
      }

      if (/\bکن\b/.test(updatedText)) {
        commentLog.push("⛔️ کلمه 'کن' در متن دکمه شناسایی شد (از طریق regex).");
      }
    }

    if (["paragraph"].includes(category)) {
      const correctedText = await checkTextWithLanguageTool(updatedText);
      if (correctedText !== updatedText) {
        updatedText = correctedText;
        commentLog.push("اصلاح با LanguageTool");
      }
    }

    if (updatedText !== originalText) {
      await figma.loadFontAsync(node.fontName);
      node.characters = updatedText;
    }

    if (commentLog.length > 0) {
      console.log(`🔎 بررسی در ${layerName}:
- متن: ${updatedText}
${commentLog.join("\n")}`);
    }
  }

  figma.closePlugin("بررسی و اصلاح متن‌ها انجام شد.");
}

runPlugin();