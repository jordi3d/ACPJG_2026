import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, RefreshCw, ChevronRight, X, QrCode } from 'lucide-react';
import {
  formatCatalanNumber,
  MemberPerformance,
  normalizeText,
  SeasonConfig,
  SeasonDataset,
} from './lib/golfData';
import { MemberReportCard } from './components/MemberReportCard';
import { LeaderboardView } from './components/LeaderboardView';
import { QrAndSettingsView } from './components/QrAndSettingsView';

type AppTab = 'search' | 'leaderboard' | 'settings';

export default function App() {
  const [dataset, setDataset] = useState<SeasonDataset | null>(null);
  const [config, setConfig] = useState<SeasonConfig>({
    season: '2026',
    sourceMode: 'default-2026',
    resultsSheetUrl: '',
    omSheetUrl: '',
    updatedAt: '',
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<AppTab>('search');
  const [query, setQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberPerformance | null>(null);

  const fetchAll = useCallback(async (forceRefresh = false) => {
    if (forceRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const [cfgRes, dataRes] = await Promise.all([
        fetch('/api/config'),
        fetch(`/api/data${forceRefresh ? '?refresh=1' : ''}`),
      ]);

      if (cfgRes.ok) {
        const cfgJson: SeasonConfig = await cfgRes.json();
        setConfig(cfgJson);
      }

      const dataJson = await dataRes.json();
      if (!dataRes.ok) {
        throw new Error(dataJson.error || 'No s’han pogut carregar les dades de la temporada');
      }

      const loadedData = dataJson as SeasonDataset;
      setDataset(loadedData);

      // Update selected member if currently viewing one
      setSelectedMember((prev) => {
        if (prev) {
          const updated = loadedData.players.find(
            (p) => p.license === prev.license || normalizeText(p.rawName) === normalizeText(prev.rawName)
          );
          return updated || null;
        }
        // Check URL query parameter ?q=... for direct QR / shared links
        const params = new URLSearchParams(window.location.search);
        const qParam = params.get('q') || params.get('license');
        if (qParam) {
          const normQ = normalizeText(qParam);
          const match = loadedData.players.find(
            (p) => normalizeText(p.license) === normQ || normalizeText(p.rawName) === normQ
          );
          if (match) return match;
        }
        return null;
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error carregant les dades');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll(false);
  }, [fetchAll]);

  const matchingMembers = useMemo(() => {
    if (!dataset) return [];
    const normQuery = normalizeText(query);
    if (!normQuery) return [];

    const tokens = normQuery.split(' ').filter(Boolean);
    return dataset.players
      .filter((player) => {
        const haystack = `${normalizeText(player.license)} ${normalizeText(player.rawName)} ${normalizeText(player.displayName)}`;
        return tokens.every((tok) => haystack.includes(tok));
      })
      .sort((a, b) => {
        // Exact license match first, then OM rank, then rounds played
        const aExact = normalizeText(a.license) === normQuery ? 1 : 0;
        const bExact = normalizeText(b.license) === normQuery ? 1 : 0;
        if (aExact !== bExact) return bExact - aExact;
        const ra = a.om?.rank ?? 9999;
        const rb = b.om?.rank ?? 9999;
        if (ra !== rb) return ra - rb;
        return b.roundsPlayed - a.roundsPlayed;
      })
      .slice(0, 15);
  }, [dataset, query]);

  const handleSelectMember = (member: MemberPerformance) => {
    setSelectedMember(member);
    setActiveTab('search');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (matchingMembers.length === 1) {
      handleSelectMember(matchingMembers[0]);
    } else if (matchingMembers.length > 0) {
      const exactLic = matchingMembers.find((m) => normalizeText(m.license) === normalizeText(query));
      if (exactLic) handleSelectMember(exactLic);
    }
  };

  const quickExamples = useMemo(() => {
    if (!dataset) return [];
    const preferred = ['CB01049293', 'CB38086819', 'CB38048537'];
    const found = preferred
      .map((lic) => dataset.players.find((p) => p.license === lic))
      .filter((p): p is MemberPerformance => Boolean(p));
    return found.length > 0 ? found : dataset.players.slice(0, 3);
  }, [dataset]);

  const currentSeason = dataset?.season || config.season || '2026';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: [Wordmark] — [Nav links] — [1 primary action] */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200 no-print">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4 sm:gap-8">
          <a
            href="#top"
            onClick={(e) => {
              e.preventDefault();
              setActiveTab('search');
              setSelectedMember(null);
            }}
            className="text-base sm:text-lg font-extrabold tracking-tight text-slate-950 whitespace-nowrap shrink-0"
          >
            PeriodistesGolf.cat
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <button
              type="button"
              onClick={() => {
                setActiveTab('search');
              }}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'search'
                  ? 'border-[#1c6d2c] text-slate-950 font-semibold'
                  : 'border-transparent hover:text-slate-950'
              }`}
            >
              Cercador
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'leaderboard'
                  ? 'border-[#1c6d2c] text-slate-950 font-semibold'
                  : 'border-transparent hover:text-slate-950'
              }`}
            >
              Ordre de Mèrit
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('settings')}
              className={`py-1 border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                activeTab === 'settings'
                  ? 'border-[#1c6d2c] text-slate-950 font-semibold'
                  : 'border-transparent hover:text-slate-950'
              }`}
            >
              QR i Temporada
            </button>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => fetchAll(true)}
              disabled={refreshing || loading}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>Actualitzar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Navigation Strip (below header, scrollable content) */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-center gap-2 no-print">
        <button
          type="button"
          onClick={() => setActiveTab('search')}
          className={`flex-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'search' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'
          }`}
        >
          Cercador
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('leaderboard')}
          className={`flex-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'leaderboard' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'
          }`}
        >
          Ordre de Mèrit
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('settings')}
          className={`flex-1 min-h-[40px] px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap cursor-pointer ${
            activeTab === 'settings' ? 'bg-slate-900 text-white' : 'text-slate-600 bg-slate-100'
          }`}
        >
          QR i {currentSeason}
        </button>
      </div>

      {/* Main Content */}
      <main id="top" className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-900 flex flex-wrap items-center justify-between gap-3">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => fetchAll(true)}
              className="min-h-[40px] px-3.5 py-1.5 text-xs font-semibold bg-red-900 text-white rounded-lg hover:bg-red-800 cursor-pointer"
            >
              Reintentar
            </button>
          </div>
        )}

        {loading && !dataset ? (
          <div className="max-w-2xl mx-auto bg-white border border-slate-200 rounded-2xl p-8 space-y-4 animate-pulse">
            <div className="w-20 h-20 rounded-full bg-slate-200 mx-auto" />
            <div className="h-7 bg-slate-200 rounded w-2/3 mx-auto" />
            <div className="h-12 bg-slate-100 rounded-xl w-full" />
            <div className="h-4 bg-slate-100 rounded w-1/2 mx-auto" />
          </div>
        ) : activeTab === 'leaderboard' && dataset ? (
          <LeaderboardView
            players={dataset.players}
            season={currentSeason}
            onSelectMember={handleSelectMember}
          />
        ) : activeTab === 'settings' ? (
          <QrAndSettingsView
            config={config}
            playerCount={dataset?.players.length ?? 0}
            activeTournamentsCount={dataset?.activeTournamentsCount ?? 0}
            onConfigSaved={() => fetchAll(true)}
          />
        ) : selectedMember ? (
          <MemberReportCard
            member={selectedMember}
            season={currentSeason}
            onBack={() => {
              setSelectedMember(null);
              if (window.location.search) {
                window.history.replaceState({}, '', window.location.pathname);
              }
            }}
          />
        ) : (
          /* Gala Lunch Member Lookup View */
          <div className="max-w-3xl mx-auto">
            <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-10 shadow-sm">
              <div className="flex flex-col items-center text-center">
                <div className="w-20 h-20 sm:w-24 sm:h-24 mb-4 flex items-center justify-center">
                  <img
                    src="/assets/aistudio/logoweb_cf2208fb.png"
                    alt="Emblema ACPJG PeriodistesGolf"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-contain"
                  />
                </div>

                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-950 text-balance">
                  Resum de la Temporada {currentSeason}
                </h1>
                <p className="mt-1.5 text-sm sm:text-base text-slate-600">
                  ACPJG – Associació Catalana de Periodistes Jugadors de Golf
                </p>

                <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500 tabular-nums">
                  <span>{dataset?.players.length ?? 0} socis</span>
                  <span aria-hidden="true">·</span>
                  <span>{dataset?.activeTournamentsCount ?? 0} proves jugades</span>
                  <span aria-hidden="true">·</span>
                  <span>PeriodistesGolf.cat</span>
                </div>
              </div>

              {/* Search Input */}
              <form onSubmit={handleSearchSubmit} className="mt-7">
                <label htmlFor="member-search" className="block text-sm font-semibold text-slate-800 mb-2">
                  Nom o número de llicència
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="member-search"
                    type="text"
                    autoComplete="off"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ex: Seve Ballesteros o CB00000001"
                    className="w-full min-h-[52px] pl-12 pr-12 py-3 text-base bg-slate-50 border border-slate-300 rounded-xl text-slate-950 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#54a425] focus:border-[#54a425] focus:bg-white transition-colors"
                  />
                  {query && (
                    <button
                      type="button"
                      onClick={() => setQuery('')}
                      aria-label="Esborrar cerca"
                      className="w-10 h-10 flex items-center justify-center absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </form>

              {/* Search Results */}
              {query.trim().length > 0 && (
                <div className="mt-4 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                  {matchingMembers.length === 0 ? (
                    <div className="p-6 text-center text-sm text-slate-500">
                      No s’ha trobat cap soci amb «{query.trim()}». Prova només amb un cognom o amb el número de llicència.
                    </div>
                  ) : (
                    matchingMembers.map((member) => (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className="w-full min-h-[60px] px-4 py-3 flex items-center justify-between gap-3 text-left hover:bg-[#84cf63]/15 active:bg-[#84cf63]/25 transition-colors cursor-pointer"
                      >
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-950 truncate">{member.displayName}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-slate-500 tabular-nums">
                            <span className="font-mono-tabular font-medium text-slate-700">{member.license}</span>
                            <span aria-hidden="true">·</span>
                            <span>{member.roundsPlayed} voltes</span>
                            {member.currentHandicap !== null && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>HCP {formatCatalanNumber(member.currentHandicap)}</span>
                              </>
                            )}
                            {member.om && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>OM {member.om.rank ?? '—'} ({member.om.points} pts)</span>
                              </>
                            )}
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-slate-400 shrink-0" />
                      </button>
                    ))
                  )}
                </div>
              )}

              {/* Helpful Quick Lookup Examples when search is empty */}
              {query.trim().length === 0 && quickExamples.length > 0 && (
                <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span>Accés ràpid:</span>
                    {quickExamples.map((ex, i) => (
                      <React.Fragment key={ex.id}>
                        <button
                          type="button"
                          onClick={() => handleSelectMember(ex)}
                          className="font-medium text-slate-700 hover:text-[#1c6d2c] underline underline-offset-2 cursor-pointer"
                        >
                          {ex.displayName}
                        </button>
                        {i < quickExamples.length - 1 && <span aria-hidden="true">·</span>}
                      </React.Fragment>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveTab('settings')}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-slate-950 cursor-pointer whitespace-nowrap"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR i enllaços 2027</span>
                  </button>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <footer className="border-t border-slate-200 bg-white py-4 px-4 sm:px-6 text-center text-xs text-slate-500 no-print">
        <span>ACPJG – Associació Catalana de Periodistes Jugadors de Golf</span>
        <span className="mx-2" aria-hidden="true">·</span>
        <span className="font-medium text-slate-700">PeriodistesGolf.cat</span>
      </footer>
    </div>
  );
}
