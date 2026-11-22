import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Web-only root HTML (static rendering). Runs in Node, no browser APIs here.
export default function Root({ children }: PropsWithChildren) {
  const { headNodes, bodyNodes, htmlAttributes, bodyAttributes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no" />
        <title>Gulलक · Gullak</title>
        <meta name="description" content="Every rupee you spend, recorded on its own." />

        {/* The main text font: fetch it early so the first paint already uses Geist. */}
        <link rel="preload" href="/fonts/geist-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
        <link rel="preload" href="/fonts/jersey-10.ttf" as="font" type="font/ttf" crossOrigin="anonymous" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />

        {/* Installable web app (Add to Home Screen) */}
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="Gulलक" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="theme-color" content="#FCEFD9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#1B100C" media="(prefers-color-scheme: dark)" />
        <meta name="format-detection" content="telephone=no" />

        <ScrollViewStyleReset />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
