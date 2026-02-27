import React, { useState, useEffect, useMemo } from 'react';
import { 
  Wind, 
  MapPin, 
  Search, 
  Activity, 
  AlertTriangle, 
  Info, 
  TrendingUp, 
  Droplets, 
  Sun, 
  Cloud,
  Brain,
  RefreshCw,
  ChevronRight
} from 'lucide-react';
import { 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell
} from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from "@google/genai";
import ReactMarkdown from 'react-markdown';
import { format } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// Utility for tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

interface AQIData {
  current: {
    european_aqi: number;
    us_aqi: number;
    pm10: number;
    pm2_5: number;
    carbon_monoxide: number;
    nitrogen_dioxide: number;
    sulphur_dioxide: number;
    ozone: number;
  };
  hourly: {
    time: string[];
    pm10: number[];
    pm2_5: number[];
    ozone: number[];
  };
}

export default function App() {
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [city, setCity] = useState<string>('Detecting location...');
  const [searchQuery, setSearchQuery] = useState('');
  const [aqiData, setAqiData] = useState<AQIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [aiInsights, setAiInsights] = useState<string>('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Fetch AQI Data
  const fetchAQI = async (lat: number, lon: number) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/air-quality?lat=${lat}&lon=${lon}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      setAqiData(data);
      generateAIInsights(data);
    } catch (err) {
      setError('Failed to fetch air quality data. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Generate AI Insights using Gemini
  const generateAIInsights = async (data: AQIData) => {
    setIsGeneratingInsights(true);
    try {
      const prompt = `
        As an environmental health expert, analyze the following air quality data for ${city}:
        - US AQI: ${data.current.us_aqi}
        - PM2.5: ${data.current.pm2_5} µg/m³
        - PM10: ${data.current.pm10} µg/m³
        - Ozone: ${data.current.ozone} µg/m³
        - NO2: ${data.current.nitrogen_dioxide} µg/m³
        - SO2: ${data.current.sulphur_dioxide} µg/m³
        - CO: ${data.current.carbon_monoxide} µg/m³

        Provide:
        1. A brief "Air Quality Prediction" for the next 24 hours based on these levels.
        2. Health recommendations for sensitive groups and the general public.
        3. One actionable tip to reduce exposure or improve local air quality.
        Keep it concise, professional, and formatted in Markdown.
      `;

      const result = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
      });
      setAiInsights(result.text || 'No insights available at this time.');
    } catch (err) {
      console.error('AI Insight Error:', err);
      setAiInsights('Unable to generate AI insights at this moment.');
    } finally {
      setIsGeneratingInsights(false);
    }
  };

  // Get User Location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          setLocation({ lat: latitude, lon: longitude });
          
          // Reverse geocode to get city name
          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`);
            const geoData = await res.json();
            setCity(geoData.address.city || geoData.address.town || geoData.address.village || 'Your Location');
          } catch (e) {
            setCity('Your Location');
          }
          
          fetchAQI(latitude, longitude);
        },
        () => {
          setError('Location access denied. Please search for a city.');
          setLoading(false);
          // Default to London if location fails
          fetchAQI(51.5074, -0.1278);
          setCity('London');
        }
      );
    }
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setLoading(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`);
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        setCity(display_name.split(',')[0]);
        fetchAQI(parseFloat(lat), parseFloat(lon));
      } else {
        setError('City not found. Try another name.');
        setLoading(false);
      }
    } catch (err) {
      setError('Search failed. Please try again.');
      setLoading(false);
    }
  };

  const getAQIStatus = (aqi: number) => {
    if (aqi <= 50) return { label: 'Good', color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/20' };
    if (aqi <= 100) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-400/10', border: 'border-yellow-400/20' };
    if (aqi <= 150) return { label: 'Unhealthy for Sensitive Groups', color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/20' };
    if (aqi <= 200) return { label: 'Unhealthy', color: 'text-red-400', bg: 'bg-red-400/10', border: 'border-red-400/20' };
    if (aqi <= 300) return { label: 'Very Unhealthy', color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/20' };
    return { label: 'Hazardous', color: 'text-rose-600', bg: 'bg-rose-600/10', border: 'border-rose-600/20' };
  };

  const hourlyData = useMemo(() => {
    if (!aqiData) return [];
    return aqiData.hourly.time.slice(0, 24).map((time, i) => ({
      time: format(new Date(time), 'HH:mm'),
      pm25: aqiData.hourly.pm2_5[i],
      ozone: aqiData.hourly.ozone[i],
    }));
  }, [aqiData]);

  const pollutantData = useMemo(() => {
    if (!aqiData) return [];
    const current = aqiData.current;
    return [
      { name: 'PM2.5', value: current.pm2_5, unit: 'µg/m³' },
      { name: 'PM10', value: current.pm10, unit: 'µg/m³' },
      { name: 'O3', value: current.ozone, unit: 'µg/m³' },
      { name: 'NO2', value: current.nitrogen_dioxide, unit: 'µg/m³' },
      { name: 'SO2', value: current.sulphur_dioxide, unit: 'µg/m³' },
      { name: 'CO', value: current.carbon_monoxide / 1000, unit: 'mg/m³' },
    ];
  }, [aqiData]);

  return (
    <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-8">
      {/* Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-emerald-500/20 rounded-xl">
            <Wind className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Aura</h1>
            <p className="text-zinc-500 text-sm flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {city}
            </p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 group-focus-within:text-emerald-400 transition-colors" />
          <input 
            type="text" 
            placeholder="Search city..." 
            className="bg-zinc-900 border border-zinc-800 rounded-full py-2.5 pl-10 pr-4 w-full md:w-64 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </form>
      </header>

      {loading ? (
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <RefreshCw className="w-12 h-12 text-emerald-400 animate-spin" />
          <p className="text-zinc-400 animate-pulse">Analyzing atmosphere...</p>
        </div>
      ) : error ? (
        <div className="glass-card p-8 text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-rose-400 mx-auto" />
          <h2 className="text-xl font-semibold">{error}</h2>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-full transition-colors"
          >
            Retry
          </button>
        </div>
      ) : (
        <motion.main 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6"
        >
          {/* Main AQI Card */}
          <div className="lg:col-span-2 space-y-6">
            <div className={cn(
              "glass-card p-8 flex flex-col md:flex-row items-center gap-8",
              aqiData && getAQIStatus(aqiData.current.us_aqi).border
            )}>
              <div className="relative">
                <svg className="w-48 h-48 -rotate-90">
                  <circle
                    cx="96"
                    cy="96"
                    r="88"
                    className="stroke-zinc-800 fill-none"
                    strokeWidth="12"
                  />
                  <motion.circle
                    cx="96"
                    cy="96"
                    r="88"
                    className={cn("fill-none", aqiData && getAQIStatus(aqiData.current.us_aqi).color.replace('text', 'stroke'))}
                    strokeWidth="12"
                    strokeDasharray={552.92}
                    initial={{ strokeDashoffset: 552.92 }}
                    animate={{ strokeDashoffset: 552.92 - (552.92 * Math.min(aqiData?.current.us_aqi || 0, 300)) / 300 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                    strokeLinecap="round"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-5xl font-bold">{aqiData?.current.us_aqi}</span>
                  <span className="text-xs font-medium text-zinc-500 uppercase tracking-widest">US AQI</span>
                </div>
              </div>

              <div className="flex-1 text-center md:text-left space-y-2">
                <div className={cn(
                  "inline-block px-3 py-1 rounded-full text-sm font-bold uppercase tracking-wider mb-2",
                  aqiData && getAQIStatus(aqiData.current.us_aqi).bg,
                  aqiData && getAQIStatus(aqiData.current.us_aqi).color
                )}>
                  {aqiData && getAQIStatus(aqiData.current.us_aqi).label}
                </div>
                <h2 className="text-2xl font-semibold">Current Air Quality</h2>
                <p className="text-zinc-400 text-sm leading-relaxed">
                  The air quality is currently {aqiData && getAQIStatus(aqiData.current.us_aqi).label.toLowerCase()} in {city}. 
                  {aqiData && aqiData.current.us_aqi > 100 ? ' Consider limiting outdoor activities.' : ' It is a good time for outdoor activities.'}
                </p>
                <div className="flex flex-wrap justify-center md:justify-start gap-4 pt-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Droplets className="w-4 h-4 text-blue-400" />
                    <span>PM2.5: {aqiData?.current.pm2_5}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Sun className="w-4 h-4 text-orange-400" />
                    <span>Ozone: {aqiData?.current.ozone}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Trends Chart */}
            <div className="glass-card p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-emerald-400" />
                  24-Hour Trends
                </h3>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-emerald-400" />
                    <span className="text-zinc-400">PM2.5</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-blue-400" />
                    <span className="text-zinc-400">Ozone</span>
                  </div>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={hourlyData}>
                    <defs>
                      <linearGradient id="colorPm" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#34d399" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorO3" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                    <XAxis 
                      dataKey="time" 
                      stroke="#71717a" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                      interval={3}
                    />
                    <YAxis 
                      stroke="#71717a" 
                      fontSize={12} 
                      tickLine={false} 
                      axisLine={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '12px' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pm25" 
                      stroke="#34d399" 
                      fillOpacity={1} 
                      fill="url(#colorPm)" 
                      strokeWidth={2}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="ozone" 
                      stroke="#60a5fa" 
                      fillOpacity={1} 
                      fill="url(#colorO3)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Sidebar: AI Insights & Pollutants */}
          <div className="space-y-6">
            {/* AI Insights Card */}
            <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Brain className="w-5 h-5 text-emerald-400" />
                  AI Prediction
                </h3>
                {isGeneratingInsights && <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />}
              </div>
              <div className="prose prose-invert prose-sm max-w-none text-zinc-300">
                {isGeneratingInsights ? (
                  <div className="space-y-3">
                    <div className="h-4 bg-zinc-800 rounded w-3/4 animate-pulse" />
                    <div className="h-4 bg-zinc-800 rounded w-full animate-pulse" />
                    <div className="h-4 bg-zinc-800 rounded w-5/6 animate-pulse" />
                  </div>
                ) : (
                  <ReactMarkdown>{aiInsights}</ReactMarkdown>
                )}
              </div>
            </div>

            {/* Pollutants Grid */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Activity className="w-5 h-5 text-zinc-400" />
                Pollutant Breakdown
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {pollutantData.map((pollutant) => (
                  <div key={pollutant.name} className="p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                    <p className="text-xs font-medium text-zinc-500 uppercase mb-1">{pollutant.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-bold">{pollutant.value.toFixed(1)}</span>
                      <span className="text-[10px] text-zinc-500">{pollutant.unit}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Health Tips */}
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-400" />
                Health Advice
              </h3>
              <ul className="space-y-4">
                <li className="flex gap-3 text-sm text-zinc-400">
                  <div className="mt-1 p-1 bg-blue-400/10 rounded">
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                  </div>
                  Keep windows closed if AQI exceeds 100.
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                  <div className="mt-1 p-1 bg-blue-400/10 rounded">
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                  </div>
                  Use air purifiers with HEPA filters indoors.
                </li>
                <li className="flex gap-3 text-sm text-zinc-400">
                  <div className="mt-1 p-1 bg-blue-400/10 rounded">
                    <ChevronRight className="w-3 h-3 text-blue-400" />
                  </div>
                  Avoid outdoor exercise during peak pollution hours.
                </li>
              </ul>
            </div>
          </div>
        </motion.main>
      )}

      <footer className="text-center py-8 border-t border-zinc-900">
        <p className="text-zinc-600 text-xs">
          Data provided by Open-Meteo & OpenStreetMap. AI insights powered by Gemini 3.
        </p>
      </footer>
    </div>
  );
}
