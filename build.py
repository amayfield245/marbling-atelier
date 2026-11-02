#!/usr/bin/env python3
"""Assemble The Marbling Atelier from src/ into two single-file pages.

  index.html          a standalone page: open it in a browser or serve it with GitHub Pages
  dist/artifact.html  the same page as a fragment, in the form published as a Claude artifact
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "src"

head = (SRC / "head.html").read_text()
css = (SRC / "page.css").read_text()
markup = (SRC / "page.html").read_text()
js = "\n".join(p.read_text() for p in sorted((SRC / "js").glob("*.js")))

body = f"<style>\n{css}</style>\n{markup}\n<script>\n{js}</script>\n"

# The artifact host wraps the fragment in its own document skeleton.
(ROOT / "dist").mkdir(exist_ok=True)
(ROOT / "dist" / "artifact.html").write_text(f"{head}{body}")

# A standalone page carries that skeleton itself.
standalone = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
{head}<style>:root{{color-scheme:light}}body{{margin:0}}img{{max-width:100%}}[hidden]{{display:none!important}}</style>
</head>
<body>
{body}</body>
</html>
"""
(ROOT / "index.html").write_text(standalone)
print(f"Built index.html ({len(standalone):,} bytes) and dist/artifact.html")
