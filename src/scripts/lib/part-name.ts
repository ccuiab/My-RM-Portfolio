/** Preserve the CAD name while removing export revision and instance suffixes. */
export function cleanPartName(name: string) {
  return name.split('/').map(segment => segment
    .replace(/\.\d{4}\.\d{1,2}\.\d{1,2}/g, '')
    .replace(/-\d+(?=\.(?:step|stp)$|$)/gi, '')
  ).join('/');
}
