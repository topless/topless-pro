import type { Beach } from '../types';

// User-initiated navigations to the visitor's own map app or site: nothing is requested
// from any provider while the page is open, so these are compatible with the privacy stance.
function coordinate(value: number): string {
  return String(Number(value.toFixed(5)));
}

export interface MapLink {
  label: string;
  href: string;
}

export function mapLinks(beach: Pick<Beach, 'name' | 'latitude' | 'longitude'>): MapLink[] {
  const lat = coordinate(beach.latitude);
  const lng = coordinate(beach.longitude);
  const name = encodeURIComponent(beach.name);
  return [
    { label: 'Apple Maps', href: `https://maps.apple.com/?ll=${lat},${lng}&q=${name}` },
    { label: 'Google Maps', href: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}` },
    { label: 'OpenStreetMap', href: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}` },
    // RFC 5870; opens the default map app on Android and some desktops, inert on iOS.
    { label: 'Other map app', href: `geo:${lat},${lng}?q=${lat},${lng}(${name})` },
  ];
}
