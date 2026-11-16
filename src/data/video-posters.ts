import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

const sources = import.meta.glob<ImageMetadata>('../../materials/images/derived/video-posters/*.jpg', { eager: true, import: 'default' });
const optimized = new Map<string, ReturnType<typeof getImage>>();

/** Native video posters stay available without JS; Astro builds small WebP copies. */
export function videoPoster(name: string) {
  const source = sources[`../../materials/images/derived/video-posters/${name}`];
  if (!source) throw new Error(`Missing video poster: ${name}`);
  let image = optimized.get(name);
  if (!image) {
    image = getImage({ src: source, width: Math.min(source.width, 1280), format: 'webp', quality: 78 });
    optimized.set(name, image);
  }
  return image;
}
