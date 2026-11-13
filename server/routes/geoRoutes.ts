import express from 'express';
import { City, Country, State } from 'country-state-city';

interface NormalizedCountry {
  isoCode: string;
  name: string;
  phonecode: string;
  flag: string;
}

const CACHED_COUNTRIES: NormalizedCountry[] = Country.getAllCountries()
  .map((c) => {
    const rawCode = String(c.phonecode || '').split(',')[0].trim();
    const cleaned = rawCode.startsWith('+') ? rawCode : rawCode ? `+${rawCode}` : '';
    return {
      isoCode: c.isoCode,
      name: c.name,
      phonecode: cleaned,
      flag: c.flag || '',
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

export function registerGeoRoutes(app: express.Express) {
  app.get('/api/geo/countries', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ countries: CACHED_COUNTRIES });
  });

  app.get('/api/geo/states/:countryCode', (req, res) => {
    const countryCode = String(req.params.countryCode || '').trim().toUpperCase();
    if (!countryCode) {
      res.status(400).json({ error: 'Country code is required.' });
      return;
    }
    const states = State.getStatesOfCountry(countryCode)
      .map((s) => ({
        isoCode: s.isoCode,
        name: s.name,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ states });
  });

  app.get('/api/geo/cities/:countryCode/:stateCode', (req, res) => {
    const countryCode = String(req.params.countryCode || '').trim().toUpperCase();
    const stateCode = String(req.params.stateCode || '').trim();
    if (!countryCode || !stateCode) {
      res.status(400).json({ error: 'Country code and state code are required.' });
      return;
    }
    const seen = new Set<string>();
    const cities = City.getCitiesOfState(countryCode, stateCode)
      .filter((c) => {
        const key = c.name.trim().toLowerCase();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map((c) => ({ name: c.name }))
      .sort((a, b) => a.name.localeCompare(b.name));

    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    res.json({ cities });
  });
}
