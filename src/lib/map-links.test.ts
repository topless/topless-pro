import { describe, expect, it } from 'vitest';
import { mapLinks } from './map-links';

describe('mapLinks', () => {
  it('builds provider-neutral links with rounded coordinates and an encoded name', () => {
    const links = mapLinks({ name: 'Cap d’Agde', latitude: 43.2934001, longitude: 3.52750009 });
    expect(links.map((link) => link.label)).toEqual(['Apple Maps', 'Google Maps', 'OpenStreetMap', 'Other map app']);
    expect(links[0].href).toBe('https://maps.apple.com/?ll=43.2934,3.5275&q=Cap%20d%E2%80%99Agde');
    expect(links[1].href).toBe('https://www.google.com/maps/search/?api=1&query=43.2934,3.5275');
    expect(links[2].href).toBe('https://www.openstreetmap.org/?mlat=43.2934&mlon=3.5275#map=16/43.2934/3.5275');
    expect(links[3].href).toBe('geo:43.2934,3.5275?q=43.2934,3.5275(Cap%20d%E2%80%99Agde)');
  });

  it('keeps whole-number coordinates short', () => {
    expect(mapLinks({ name: 'X', latitude: 35, longitude: 25 })[1].href).toContain('query=35,25');
  });
});
