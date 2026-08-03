// Egyetlen kép-dekódolási út: `<img>` elem egy object URL-lel. A dekódolt méret
// az, amit a böngésző megjelenítendőnek tart, tehát ha a böngésző alkalmazza az
// EXIF-orientációt, akkor ez már az elforgatott méret.

export interface DecodedImage {
  image: HTMLImageElement;
  width: number;
  height: number;
}

export function decodeImageElement(source: Blob): Promise<DecodedImage> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(source);
    const image = new Image();

    image.onload = () => {
      resolve({ image, width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    };

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Nem sikerült beolvasni a képet.'));
    };

    image.src = objectUrl;
  });
}
