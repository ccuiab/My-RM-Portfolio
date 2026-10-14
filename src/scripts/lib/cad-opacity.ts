import type { Material } from 'three';

/** Keep fading CAD surfaces in one render queue with depth writes enabled.
 * Switching depthWrite off at opacity 1 or .5 lets rear triangles overwrite
 * the front wall even when the visible opacity barely changed. */
export function setCadOpacity(material: Material, opacity: number) {
  if (material.alphaHash || !material.transparent) {
    material.alphaHash = false;
    material.transparent = true;
    material.needsUpdate = true;
  }
  material.depthWrite = true;
  material.opacity = Math.max(0, Math.min(1, opacity));
}
