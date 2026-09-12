import { firefox } from "playwright";
const b = await firefox.launch();
const p = await b.newPage();
await p.goto("http://localhost:3000");
const m = await p.evaluate(() => {
  const el = document.createElement("pre");
  el.style.cssText = "font-family:var(--font-spline-mono);font-size:100px;position:absolute;visibility:hidden";
  el.textContent = "0".repeat(100);
  document.body.appendChild(el);
  const w = el.getBoundingClientRect().width / 100 / 100; // em advance
  el.remove();
  return w;
});
console.log("Spline Sans Mono advance:", m.toFixed(4), "em");
await b.close();
