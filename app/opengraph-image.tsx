import { ImageResponse } from "next/og";

export const alt = "Find KU Dae";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * The share card. PRODUCT.md names the distribution channel as a link pasted
 * into a LINE or Facebook group, so this image is what most first-time
 * visitors actually see before they see the site.
 *
 * Latin only, deliberately: ImageResponse would need a Thai font shipped and
 * loaded per request, and the wordmark reads the same in both locales.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "96px",
          // Mirrors --color-green-600 / --color-lime-500 in globals.css.
          background: "#00706b",
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 92, fontWeight: 700 }}>
          <span>Find </span>
          <span style={{ color: "#e4ee4a" }}>KU</span>
          <span> Dae</span>
        </div>
        <div
          style={{
            width: 220,
            height: 12,
            background: "#b8c214",
            marginTop: 20,
            display: "flex",
          }}
        />
        <div
          style={{
            display: "flex",
            marginTop: 44,
            fontSize: 40,
            color: "#c6ece8",
            maxWidth: 820,
          }}
        >
          Find every photo you are in, from any Kasetsart University event.
        </div>
      </div>
    ),
    size,
  );
}
