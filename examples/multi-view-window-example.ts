/**
 * Multi-Window Example
 *
 * Demonstrates creating multiple windows, each with its own WebView,
 * sharing a single EventLoop.
 *
 * NOTE: On Linux/GTK, each window can only host a single webview due to
 * GTK's GtkBin constraint. This example uses multiple windows instead.
 */

import { WindowBuilder, WebViewBuilder, EventLoop, TaoTheme } from '../index.js'
import { createLogger } from './logger.ts'

const logger = createLogger('MultiWindow')

interface ViewConfig {
  label: string
  title: string
  html: string
}

class MultiWindowManager {
  private windows: Map<string, { window: any; webview: any }> = new Map()

  constructor() {
    logger.info('Multi-Window Manager initialized')
  }

  /**
   * Add a window+webview pair to the manager
   */
  addView(label: string, window: any, webview: any): void {
    this.windows.set(label, { window, webview })
    logger.info('View added', { label, windowId: window.id, webviewId: webview.id })
  }

  /**
   * Get a specific view by label
   */
  getView(label: string): { window: any; webview: any } | undefined {
    return this.windows.get(label)
  }

  /**
   * Log all views information
   */
  logViewsInfo(): void {
    logger.section('Views Information')
    this.windows.forEach(({ window, webview }, label) => {
      logger.object(`View: ${label}`, {
        windowId: window.id,
        title: window.title(),
        webviewId: webview.id,
        label: webview.label
      })
    })
  }

}

/**
 * Create header HTML
 */
function createHeaderHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Header View</title>
        <style>
          body {
            margin: 0;
            padding: 0;
            background: #1e293b;
            color: white;
            font-family: system-ui;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            border-bottom: 2px solid #38bdf8;
          }
          h1 {
            margin: 0;
            font-size: 1.5rem;
            color: #38bdf8;
          }
        </style>
      </head>
      <body>
        <h1>Multi-Window Control Panel</h1>
      </body>
    </html>
  `
}

/**
 * Create content HTML
 */
function createContentHtml(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Content View</title>
        <style>
          body {
            margin: 0;
            padding: 40px;
            background: #0f172a;
            color: #94a3b8;
            font-family: system-ui;
          }
          h2 {
            color: #38bdf8;
            margin-bottom: 20px;
          }
          .grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
            gap: 20px;
          }
          .card {
            background: #1e293b;
            padding: 20px;
            border-radius: 10px;
            border: 1px solid #334155;
            transition: transform 0.3s ease;
          }
          .card:hover {
            transform: translateY(-5px);
            border-color: #38bdf8;
          }
          .card h3 {
            color: white;
            margin-top: 0;
            margin-bottom: 10px;
          }
          button {
            background: #38bdf8;
            color: #0f172a;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-weight: bold;
            transition: background 0.3s ease;
          }
          button:hover {
            background: #7dd3fc;
          }
        </style>
      </head>
      <body>
        <h2>Dashboard</h2>
        <div class="grid">
          <div class="card">
            <h3>Statistics</h3>
            <p>Active users: 1,234</p>
            <button onclick="alert('Updating...')">Update</button>
          </div>
          <div class="card">
            <h3>Status</h3>
            <p>System operating correctly</p>
          </div>
          <div class="card">
            <h3>Performance</h3>
            <p>CPU: 24% | RAM: 4.2 GB</p>
          </div>
          <div class="card">
            <h3>Network</h3>
            <p>Bandwidth: 12.5 Mb/s</p>
          </div>
        </div>
      </body>
    </html>
  `
}

/**
 * Main function to run multi-window example
 */
async function main() {
  logger.banner('Multi-Window Example', 'Demonstrating multiple windows with shared EventLoop')

  try {
    logger.info('Creating event loop...')
    const eventLoop = new EventLoop()
    const multiWindowManager = new MultiWindowManager()

    logger.success('Event loop created')

    logger.section('Creating Header Window')
    const headerHtml = createHeaderHtml()
    const headerWindow = new WindowBuilder()
      .withTitle('Control Panel')
      .withInnerSize(500, 400)
      .withTheme(TaoTheme.Dark)
      .build(eventLoop)
    const headerView = new WebViewBuilder()
      .withHtml(headerHtml)
      .buildOnWindow(headerWindow, 'header-view')

    multiWindowManager.addView('header', headerWindow, headerView)
    logger.success('Header window created', { windowId: headerWindow.id, webviewId: headerView.id })

    logger.section('Creating Content Window')
    const contentHtml = createContentHtml()
    const contentWindow = new WindowBuilder()
      .withTitle('Dashboard')
      .withInnerSize(600, 500)
      .withPosition(520, 100)
      .withTheme(TaoTheme.Dark)
      .build(eventLoop)
    const contentView = new WebViewBuilder()
      .withHtml(contentHtml)
      .buildOnWindow(contentWindow, 'content-view')

    multiWindowManager.addView('content', contentWindow, contentView)
    logger.success('Content window created', { windowId: contentWindow.id, webviewId: contentView.id })

    multiWindowManager.logViewsInfo()

    logger.section('Multi-Window Features')
    logger.info('Multiple independent windows')
    logger.info('Each window hosts its own WebView')
    logger.info('Shared EventLoop for event processing')
    logger.info('Individual window management')

    logger.section('Starting Event Loop')
    logger.info('Press Ctrl+C to exit')

    eventLoop.run()

  } catch (error) {
    logger.error('Error executing multi-window example', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    process.exit(1)
  }
}

main()