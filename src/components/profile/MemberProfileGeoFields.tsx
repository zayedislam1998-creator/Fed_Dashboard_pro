import React, { useEffect, useMemo, useState } from 'react';
import { Globe, MapPin, Phone } from 'lucide-react';
import {
  fetchGeoCities,
  fetchGeoCountries,
  fetchGeoStates,
  type GeoCity,
  type GeoCountry,
  type GeoState,
} from '../../services/workspaceAuth';

export interface ProfileGeoFormValue {
  phoneCountryCode: string;
  phoneNumber: string;
  countryCode: string;
  countryName: string;
  stateCode: string;
  stateName: string;
  cityName: string;
  addressLine: string;
  zipCode: string;
}

const POPULAR_ISO_CODES = ['US', 'BD', 'GB', 'CA', 'AU', 'AE', 'SA', 'IN', 'DE', 'SG'];

interface MemberProfileGeoFieldsProps {
  idPrefix: string;
  value: ProfileGeoFormValue;
  onChange: (next: ProfileGeoFormValue) => void;
}

export const MemberProfileGeoFields: React.FC<MemberProfileGeoFieldsProps> = ({
  idPrefix,
  value,
  onChange,
}) => {
  const [countries, setCountries] = useState<GeoCountry[]>([]);
  const [states, setStates] = useState<GeoState[]>([]);
  const [cities, setCities] = useState<GeoCity[]>([]);
  const [loadingStates, setLoadingStates] = useState(false);
  const [loadingCities, setLoadingCities] = useState(false);

  useEffect(() => {
    let active = true;
    fetchGeoCountries()
      .then((list) => {
        if (!active) return;
        setCountries(list);
        if (!value.countryCode && list.length > 0) {
          const usa = list.find((c) => c.isoCode === 'US') || list[0];
          onChange({
            ...value,
            countryCode: usa.isoCode,
            countryName: usa.name,
            phoneCountryCode: value.phoneCountryCode || usa.phonecode || '+1',
          });
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!value.countryCode) {
      setStates([]);
      return;
    }
    let active = true;
    setLoadingStates(true);
    fetchGeoStates(value.countryCode)
      .then((list) => {
        if (active) setStates(list);
      })
      .catch(() => {
        if (active) setStates([]);
      })
      .finally(() => {
        if (active) setLoadingStates(false);
      });
    return () => {
      active = false;
    };
  }, [value.countryCode]);

  useEffect(() => {
    if (!value.countryCode || !value.stateCode) {
      setCities([]);
      return;
    }
    let active = true;
    setLoadingCities(true);
    fetchGeoCities(value.countryCode, value.stateCode)
      .then((list) => {
        if (active) setCities(list);
      })
      .catch(() => {
        if (active) setCities([]);
      })
      .finally(() => {
        if (active) setLoadingCities(false);
      });
    return () => {
      active = false;
    };
  }, [value.countryCode, value.stateCode]);

  const { popularCountries, otherCountries } = useMemo(() => {
    const pop: GeoCountry[] = [];
    const rest: GeoCountry[] = [];
    for (const c of countries) {
      if (POPULAR_ISO_CODES.includes(c.isoCode)) pop.push(c);
      else rest.push(c);
    }
    pop.sort(
      (a, b) => POPULAR_ISO_CODES.indexOf(a.isoCode) - POPULAR_ISO_CODES.indexOf(b.isoCode)
    );
    return { popularCountries: pop, otherCountries: rest };
  }, [countries]);

  const handleCountrySelect = (isoCode: string) => {
    const match = countries.find((c) => c.isoCode === isoCode);
    if (!match) return;
    onChange({
      ...value,
      countryCode: match.isoCode,
      countryName: match.name,
      phoneCountryCode: match.phonecode || value.phoneCountryCode,
      stateCode: '',
      stateName: '',
      cityName: '',
    });
  };

  const handleStateSelect = (isoCode: string) => {
    const match = states.find((s) => s.isoCode === isoCode);
    onChange({
      ...value,
      stateCode: match?.isoCode || isoCode,
      stateName: match?.name || isoCode,
      cityName: '',
    });
  };

  const inputClass =
    'auth-control w-full min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-300/90 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#0B57D0]/30 focus:border-[#0B57D0] transition';

  return (
    <div className="space-y-3.5">
      {/* Phone Number with Dial-Code Country Selector */}
      <div>
        <label
          htmlFor={`${idPrefix}-phone`}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          Phone Number <span className="text-rose-500" aria-hidden="true">*</span>
        </label>
        <div className="flex gap-2">
          <div className="w-[148px] shrink-0">
            <label htmlFor={`${idPrefix}-dial`} className="sr-only">
              Country Dial Code
            </label>
            <div className="relative">
              <Phone className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <select
                id={`${idPrefix}-dial`}
                name="phoneCountryCode"
                aria-label="Country dial code"
                value={value.phoneCountryCode}
                onChange={(e) =>
                  onChange({ ...value, phoneCountryCode: e.target.value })
                }
                className={`${inputClass} pl-8 pr-2 text-xs font-medium`}
              >
                {popularCountries.length > 0 && (
                  <optgroup label="Popular Dial Codes">
                    {popularCountries
                      .filter((c) => c.phonecode)
                      .map((c) => (
                        <option key={`pop-dial-${c.isoCode}`} value={c.phonecode}>
                          {c.flag} {c.phonecode} ({c.isoCode})
                        </option>
                      ))}
                  </optgroup>
                )}
                <optgroup label="All Countries">
                  {otherCountries
                    .filter((c) => c.phonecode)
                    .map((c) => (
                      <option key={`dial-${c.isoCode}`} value={c.phonecode}>
                        {c.flag} {c.phonecode} ({c.isoCode})
                      </option>
                    ))}
                </optgroup>
              </select>
            </div>
          </div>
          <input
            id={`${idPrefix}-phone`}
            name="phoneNumber"
            type="tel"
            autoComplete="tel-national"
            inputMode="tel"
            enterKeyHint="next"
            required
            value={value.phoneNumber}
            onChange={(e) => onChange({ ...value, phoneNumber: e.target.value })}
            placeholder="(555) 234-5678"
            className={`${inputClass} flex-1`}
          />
        </div>
      </div>

      {/* Auto-Populating Cascading Location Section */}
      <fieldset className="rounded-2xl bg-slate-50/90 border border-slate-200/80 p-3.5 space-y-3">
        <legend className="px-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-[#0B57D0]" />
          <span>Location & Mailing Address</span>
        </legend>

        <div>
          <label
            htmlFor={`${idPrefix}-country`}
            className="block text-xs font-semibold text-slate-700 mb-1"
          >
            Country <span className="text-rose-500" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <Globe className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select
              id={`${idPrefix}-country`}
              name="countryCode"
              autoComplete="country"
              required
              value={value.countryCode}
              onChange={(e) => handleCountrySelect(e.target.value)}
              className={`${inputClass} pl-9`}
            >
              <option value="">Select your country...</option>
              {popularCountries.length > 0 && (
                <optgroup label="Popular Countries">
                  {popularCountries.map((c) => (
                    <option key={`pop-c-${c.isoCode}`} value={c.isoCode}>
                      {c.flag} {c.name} ({c.phonecode})
                    </option>
                  ))}
                </optgroup>
              )}
              <optgroup label="All Countries (Aâ€“Z)">
                {otherCountries.map((c) => (
                  <option key={`c-${c.isoCode}`} value={c.isoCode}>
                    {c.flag} {c.name} ({c.phonecode})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Cascading State / Division */}
          <div>
            <label
              htmlFor={`${idPrefix}-state`}
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              State / Province
            </label>
            {states.length > 0 || !value.countryCode || loadingStates ? (
              <select
                id={`${idPrefix}-state`}
                name="stateCode"
                autoComplete="address-level1"
                required={states.length > 0}
                disabled={!value.countryCode || loadingStates}
                value={value.stateCode}
                onChange={(e) => handleStateSelect(e.target.value)}
                className={inputClass}
              >
                <option value="">
                  {value.countryCode
                    ? 'Select state / province'
                    : 'Choose country first'}
                </option>
                {states.map((s) => (
                  <option key={s.isoCode} value={s.isoCode}>
                    {s.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${idPrefix}-state`}
                name="stateName"
                type="text"
                autoComplete="address-level1"
                value={value.stateName}
                onChange={(e) =>
                  onChange({ ...value, stateName: e.target.value, stateCode: '' })
                }
                placeholder="State / Region"
                className={inputClass}
              />
            )}
          </div>

          {/* Cascading City */}
          <div>
            <label
              htmlFor={`${idPrefix}-city`}
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              City
            </label>
            {states.length > 0 && !value.stateCode ? (
              <select
                id={`${idPrefix}-city`}
                name="cityName"
                autoComplete="address-level2"
                disabled
                value=""
                onChange={() => {}}
                className={inputClass}
              >
                <option value="">Choose state first</option>
              </select>
            ) : cities.length > 0 || loadingCities ? (
              <select
                id={`${idPrefix}-city`}
                name="cityName"
                autoComplete="address-level2"
                required={cities.length > 0}
                disabled={!value.stateCode || loadingCities}
                value={value.cityName}
                onChange={(e) => onChange({ ...value, cityName: e.target.value })}
                className={inputClass}
              >
                <option value="">
                  {'Select city'}
                </option>
                {cities.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={`${idPrefix}-city`}
                name="cityName"
                type="text"
                autoComplete="address-level2"
                required
                value={value.cityName}
                onChange={(e) => onChange({ ...value, cityName: e.target.value })}
                placeholder="Enter city name"
                className={inputClass}
              />
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-2">
            <label
              htmlFor={`${idPrefix}-address`}
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              Street Address <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <input
              id={`${idPrefix}-address`}
              name="addressLine"
              type="text"
              autoComplete="street-address"
              enterKeyHint="next"
              required
              value={value.addressLine}
              onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
              placeholder="House, road, apartment / suite"
              className={inputClass}
            />
          </div>

          <div>
            <label
              htmlFor={`${idPrefix}-zip`}
              className="block text-xs font-semibold text-slate-700 mb-1"
            >
              ZIP / Postal Code <span className="text-rose-500" aria-hidden="true">*</span>
            </label>
            <input
              id={`${idPrefix}-zip`}
              name="zipCode"
              type="text"
              autoComplete="postal-code"
              enterKeyHint="next"
              required
              value={value.zipCode}
              onChange={(e) => onChange({ ...value, zipCode: e.target.value })}
              placeholder="e.g. 10001"
              className={inputClass}
            />
          </div>
        </div>
      </fieldset>
    </div>
  );
};

