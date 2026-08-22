/**
 * Reusable HTML templates for the examples.
 *
 * Keeps the example files short by moving repetitive page markup here. Every
 * template is a plain string you can pass straight to `createWebview({ html })`
 * or `new WebViewBuilder().withHtml(...)`.
 */

/** A simple centered page good enough for most window/webview demos. */
export function basicPage(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, sans-serif;
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        color: #1f2937;
        background: #f3f4f6;
      }
      .card {
        text-align: center;
        padding: 2.5rem 3rem;
        border-radius: 1rem;
        background: #fff;
        box-shadow: 0 10px 30px -12px rgb(0 0 0 / 0.3);
      }
    </style>
  </head>
  <body>
    <div class="card">${body}</div>
  </body>
</html>`;
}

/** A heading + paragraph card. */
export function titleCard(title: string, subtitle: string): string {
  return basicPage(
    title,
    `<h1>${title}</h1>
     <p>${subtitle}</p>`,
  );
}