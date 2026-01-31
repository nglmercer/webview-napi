// Autoplay
import { EventLoop, WebViewBuilder } from "../index.js";

const eventLoop = new EventLoop();
const title = "Autoplay-Test";

const webview = new WebViewBuilder()
  .withHtml(`<!DOCTYPE html>
<html>
  <head>
    <title>Webview</title>
    <style>
      body {
        margin: 0;
        padding: 20px;
        font-family: Arial, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        min-height: 100vh;
      }
      h1 {
        text-align: center;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
      }
      video {
        display: block;
        margin: 20px auto;
        max-width: 100%;
        border-radius: 8px;
        box-shadow: 0 4px 6px rgba(0,0,0,0.3);
      }
    </style>
  </head>
  <body>
    <h1 id="output">Hello world!</h1>
    <video autoplay controls width="640">
      <source src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4" type="video/mp4">
    </video>
  </body>
</html>`)
  .withTitle(title)
  .withWidth(800)
  .withHeight(600)
  .build(eventLoop, title);

console.log("WebView ID:", webview.id);

// Run the event loop
const poll = () => {
    if (eventLoop.runIteration()) {
        webview.id;
        setTimeout(poll, 10);
    } else {
        process.exit(0);
    }
};
poll()