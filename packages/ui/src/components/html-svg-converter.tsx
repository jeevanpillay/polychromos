"use client";

import { useRef, useState } from "react";

import { copySvgToClipboard, downloadSvg, htmlToSvg } from "../lib/html-to-svg";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";

const COMMON_FONTS = [
  "Arial, sans-serif",
  "Helvetica, sans-serif",
  "Times New Roman, serif",
  "Georgia, serif",
  "Courier New, monospace",
  "Trebuchet MS, sans-serif",
  "Verdana, sans-serif",
  "Comic Sans MS, cursive",
];

const FONT_WEIGHTS = ["300", "400", "500", "600", "700", "800", "900"];

export function HtmlSvgConverter() {
  const [text, setText] = useState("JEEVAN PILLAY");
  const [fontSize, setFontSize] = useState(48);
  const [fontFamily, setFontFamily] = useState("Arial, sans-serif");
  const [fontWeight, setFontWeight] = useState("700");
  const [letterSpacing, setLetterSpacing] = useState(-1);
  const [fill, setFill] = useState("#ffffff");
  const [width, setWidth] = useState(800);
  const [height, setHeight] = useState(200);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  const svgString = htmlToSvg({
    text,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing,
    fill,
    width,
    height,
  });

  const handleCopy = async () => {
    try {
      await copySvgToClipboard({
        text,
        fontSize,
        fontFamily,
        fontWeight,
        letterSpacing,
        fill,
        width,
        height,
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownload = () => {
    downloadSvg({
      text,
      fontSize,
      fontFamily,
      fontWeight,
      letterSpacing,
      fill,
      width,
      height,
      filename: "text-export.svg",
    });
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-8 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">HTML to SVG Converter</h1>
        <p className="text-muted-foreground">
          Convert text to SVG with customizable fonts and styling
        </p>
      </div>

      {/* Controls */}
      <div className="bg-card grid grid-cols-1 gap-6 rounded-lg border p-6 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="text">Text</Label>
          <Textarea
            id="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Enter text to convert"
            className="h-24"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="color">Fill Color</Label>
          <div className="flex gap-2">
            <Input
              id="color"
              type="color"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              className="h-10 w-20 cursor-pointer"
            />
            <Input
              type="text"
              value={fill}
              onChange={(e) => setFill(e.target.value)}
              placeholder="#ffffff"
              className="flex-1"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fontSize">Font Size: {fontSize}px</Label>
          <Input
            id="fontSize"
            type="range"
            min="12"
            max="200"
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="fontFamily">Font Family</Label>
          <select
            id="fontFamily"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {COMMON_FONTS.map((font) => (
              <option key={font} value={font}>
                {font.split(",")[0]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="fontWeight">Font Weight</Label>
          <select
            id="fontWeight"
            value={fontWeight}
            onChange={(e) => setFontWeight(e.target.value)}
            className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
          >
            {FONT_WEIGHTS.map((weight) => (
              <option key={weight} value={weight}>
                {weight}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="letterSpacing">Letter Spacing: {letterSpacing}</Label>
          <Input
            id="letterSpacing"
            type="range"
            min="-5"
            max="20"
            value={letterSpacing}
            onChange={(e) => setLetterSpacing(Number(e.target.value))}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="width">Width: {width}px</Label>
          <Input
            id="width"
            type="range"
            min="100"
            max="1600"
            step="50"
            value={width}
            onChange={(e) => setWidth(Number(e.target.value))}
            className="cursor-pointer"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="height">Height: {height}px</Label>
          <Input
            id="height"
            type="range"
            min="50"
            max="500"
            step="10"
            value={height}
            onChange={(e) => setHeight(Number(e.target.value))}
            className="cursor-pointer"
          />
        </div>
      </div>

      {/* Preview */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">Preview</h2>
        <div
          ref={svgContainerRef}
          className="w-full overflow-auto rounded-lg border bg-black p-6"
          dangerouslySetInnerHTML={{ __html: svgString }}
        />
      </div>

      {/* SVG Code */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">SVG Code</h2>
        <pre className="bg-card max-h-48 overflow-auto rounded-lg border p-4 text-xs">
          <code>{svgString}</code>
        </pre>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleCopy} variant="default">
          {copied ? "Copied!" : "Copy SVG"}
        </Button>
        <Button onClick={handleDownload} variant="outline">
          Download SVG
        </Button>
      </div>
    </div>
  );
}
