/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { LiveHubWeather, LiveWeatherResponse } from '../types/disaster';
import {
  Cloud,
  CloudFog,
  CloudLightning,
  CloudRain,
  Droplets,
  RefreshCw,
  Sun,
  Thermometer,
  Wind,
  AlertCircle,
  ArrowUpRight,
} from 'lucide-react';

interface LiveWeatherWidgetProps {
  onSelectHubDistrict: (districtId: string) => void;
}

function WeatherConditionIcon({ condition }: { condition: string }) {
  const lower = condition.toLowerCase();
  if (lower.includes('thunder') || lower.includes('storm')) {
    return <CloudLightning className="w-5 h-5 text-amber-400 shrink-0" />;
  }
  if (lower.includes('rain') || lower.includes('drizzle') || lower.includes('shower')) {
    return <CloudRain className="w-5 h-5 text-sky-400 shrink-0" />;
  }
  if (lower.includes('fog') || lower.includes('mist') || lower.includes('haze') || lower.includes('smoke')) {
    return <CloudFog className="w-5 h-5 text-slate-300 shrink-0" />;
  }
  if (lower.includes('cloud') || lower.includes('overcast')) {
    return <Cloud className="w-5 h-5 text-slate-300 shrink-0" />;
  }
  return <Sun className="w-5 h-5 text-amber-300 shrink-0" />;
}

export const LiveWeatherWidget: React.FC<LiveWeatherWidgetProps> = ({
  onSelectHubDistrict,
}) => {
  const [weatherData, setWeatherData] = useState<LiveWeatherResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [regionFilter, setRegionFilter] = useState<'all' | 'coastal' | 'inland'>('all');

  const loadWeather = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setErrorMessage('');

    try {
      const endpoint = forceRefresh
        ? '/api/weather/odisha-hubs?refresh=true'
        : '/api/weather/odisha-hubs';
      const response = await fetch(endpoint);
      if (!response.ok) {
        const errPayload = await response.json().catch(() => ({}));
        throw new Error(errPayload.error || `Weather feed returned status ${response.status}`);
      }
      const data = (await response.json()) as LiveWeatherResponse;
      setWeatherData(data);
    } catch (err: unknown) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Unable to fetch real-time Odisha hub weather.'
      );
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadWeather(false);
  }, [loadWeather]);

  const hubs: LiveHubWeather[] = weatherData?.hubs || [];
  const filteredHubs = hubs.filter((hub) => {
    if (regionFilter === 'coastal') {
      return ['puri', 'balasore', 'berhampur', 'bhubaneswar', 'cuttack'].includes(hub.id);
    }
    if (regionFilter === 'inland') {
      return ['sambalpur', 'cuttack', 'bhubaneswar'].includes(hub.id);
    }
    return true;
  });

  const formattedUpdatedTime = weatherData?.fetchedAt
    ? new Date(weatherData.fetchedAt).toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  return (
    <section
      aria-label="Real-Time Odisha Hub Weather"
      className="bg-[#0D1527] border border-slate-800 rounded-xl p-5 space-y-4"
    >
      {/* Header Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800/80 pb-3.5">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-white">
              Real-Time Odisha Hub Weather
            </h2>
            <span className="text-xs text-teal-400 font-medium">
              Live External Feed
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span>{weatherData?.provider || 'Free Meteorological API (No Key Required)'}</span>
            <span aria-hidden="true">·</span>
            <span>Actual surface readings, independent of simulated hazard indices</span>
            {formattedUpdatedTime && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-slate-300">
                  Updated {formattedUpdatedTime} IST
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Corridor Filter Segmented Control */}
          <div className="flex items-center gap-1 p-1 bg-slate-900 border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setRegionFilter('all')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                regionFilter === 'all'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All Hubs
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('coastal')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                regionFilter === 'coastal'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Coastal
            </button>
            <button
              type="button"
              onClick={() => setRegionFilter('inland')}
              className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                regionFilter === 'inland'
                  ? 'bg-teal-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Central & West
            </button>
          </div>

          <button
            type="button"
            onClick={() => loadWeather(true)}
            disabled={isLoading || isRefreshing}
            className="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 border border-slate-700 rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
          </button>
        </div>
      </div>

      {/* Loading Skeleton State */}
      {isLoading && hubs.length === 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-[#121B30] border border-slate-800 rounded-lg p-4 space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="space-y-1.5">
                  <div className="h-4 w-28 bg-slate-800 rounded" />
                  <div className="h-3 w-36 bg-slate-800/70 rounded" />
                </div>
                <div className="h-7 w-14 bg-slate-800 rounded" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800/80">
                <div className="h-8 bg-slate-800/70 rounded" />
                <div className="h-8 bg-slate-800/70 rounded" />
                <div className="h-8 bg-slate-800/70 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : errorMessage && hubs.length === 0 ? (
        <div className="bg-[#121B30] border border-rose-500/30 rounded-lg p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3 text-xs">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <div className="font-semibold text-rose-300">
                Live Weather Feed Temporarily Unavailable
              </div>
              <p className="text-slate-400">{errorMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => loadWeather(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-teal-600 hover:bg-teal-500 rounded-lg transition-colors whitespace-nowrap shrink-0 self-start sm:self-center"
          >
            Retry Connection
          </button>
        </div>
      ) : (
        <>
          {errorMessage && (
            <div className="text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
              <span>Refresh warning: {errorMessage} (showing last fetched readings).</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredHubs.map((hub) => (
              <button
                key={hub.id}
                type="button"
                onClick={() => onSelectHubDistrict(hub.districtId)}
                className="text-left bg-[#121B30] hover:bg-[#16223D] border border-slate-800 hover:border-teal-500/40 rounded-lg p-4 transition-colors space-y-3 group"
              >
                {/* Hub Name & Current Temp */}
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-white truncate">
                        {hub.hubName}
                      </span>
                      <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-teal-400 transition-colors shrink-0" />
                    </div>
                    <div className="text-xs text-slate-400 truncate">
                      {hub.corridorLabel}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <WeatherConditionIcon condition={hub.condition} />
                    <span className="text-2xl font-bold text-white font-mono tabular-nums">
                      {hub.temperatureC}°C
                    </span>
                  </div>
                </div>

                {/* Condition line */}
                <div className="flex items-center justify-between text-xs text-slate-300">
                  <span className="truncate">{hub.condition}</span>
                  <span className="text-slate-400 font-mono tabular-nums shrink-0">
                    Feels {hub.feelsLikeC}°C
                  </span>
                </div>

                {/* Telemetry Strip: Temp, Humidity, Wind Speed */}
                <div className="grid grid-cols-3 gap-2 pt-2.5 border-t border-slate-800/80 text-xs">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Thermometer className="w-3 h-3 text-amber-400 shrink-0" />
                      <span>Temp</span>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-slate-100">
                      {hub.temperatureC}°C
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Droplets className="w-3 h-3 text-sky-400 shrink-0" />
                      <span>Humidity</span>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-slate-100">
                      {hub.humidityPercent}%
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                      <Wind className="w-3 h-3 text-teal-400 shrink-0" />
                      <span>Wind</span>
                    </div>
                    <div className="font-mono tabular-nums font-semibold text-slate-100">
                      {hub.windSpeedKmph} km/h <span className="text-slate-400 font-normal">{hub.windDirection}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>

          {weatherData?.disclaimer && (
            <div className="text-[11px] text-slate-400 border-t border-slate-800/70 pt-2.5">
              {weatherData.disclaimer}
            </div>
          )}
        </>
      )}
    </section>
  );
};
