import { asset } from "./paths";

const SHEETS = [
  "walker",
  "cone",
  "bucket",
  "imp",
  "football",
  "pea",
  "nut",
  "sun",
  "ice",
  "pea-shot",
  "ice-shot",
  "impact",
  "house",
  "brain",
  "grave",
] as const;

const PHOTOS = ["title", "grass"] as const;

export type SheetName = (typeof SHEETS)[number];
export type PhotoName = (typeof PHOTOS)[number];

export interface Assets {
  sheets: Record<SheetName, HTMLImageElement>;
  photos: Record<PhotoName, HTMLImageElement>;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load ${src}`));
    img.src = src;
  });
}

export async function loadAssets(): Promise<Assets> {
  const sheets = {} as Record<SheetName, HTMLImageElement>;
  const photos = {} as Record<PhotoName, HTMLImageElement>;
  await Promise.all([
    ...SHEETS.map(async (name) => {
      sheets[name] = await loadImage(asset(`sprites/${name}.png`));
    }),
    ...PHOTOS.map(async (name) => {
      photos[name] = await loadImage(asset(`sprites/${name}.jpg`));
    }),
  ]);
  return { sheets, photos };
}

export function frameRect(img: HTMLImageElement, index: number, cols = 2, rows = 2) {
  const fw = img.width / cols;
  const fh = img.height / rows;
  const col = index % cols;
  const row = Math.floor(index / cols) % rows;
  return { sx: col * fw, sy: row * fh, sw: fw, sh: fh };
}
