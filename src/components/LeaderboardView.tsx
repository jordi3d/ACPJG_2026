import React, { useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { formatCatalanNumber, MemberPerformance, normalizeText } from '../lib/golfData';

interface LeaderboardViewProps {
  players: MemberPerformance[];
  season: string;
  onSelectMember: (member: MemberPerformance) => void;
}

export const LeaderboardView: React.FC<LeaderboardViewProps> = ({ players, season, onSelectMember }) => {
  const [filter, setFilter] = useState('');

  const rankedPlayers = useMemo(() => {
    const query = normalizeText(filter);
    return players
      .filter((p) => p.om !== null)
      .sort((a, b) => {
        const ra = a.om?.rank ?? 9999;
        const rb = b.om?.rank ?? 9999;
        if (ra !== rb) return ra - rb;
        return (b.om?.points ?? 0) - (a.om?.points ?? 0);
      })
      .filter((p) => {
        if (!query) return true;
        return (
          normalizeText(p.displayName).includes(query) ||
          normalizeText(p.rawName).includes(query) ||
          normalizeText(p.license).includes(query)
        );
      });
  }, [players, filter]);

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-950">Ordre de Mèrit {season}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {rankedPlayers.length} jugadors classificats · Toca qualsevol nom per veure el seu resum personal
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filtrar per nom o llicència..."
            className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#54a425] focus:bg-white"
          />
        </div>
      </div>

      {rankedPlayers.length === 0 ? (
        <div className="p-10 text-center text-sm text-slate-500">
          No s’han trobat jugadors a l’Ordre de Mèrit amb aquest filtre.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <th className="py-3 pl-5 pr-3 text-left font-semibold">OM</th>
                <th className="py-3 px-3 text-left font-semibold">Jugador / Llicència</th>
                <th className="py-3 px-3 text-right font-semibold">Punts</th>
                <th className="py-3 px-3 text-right font-semibold hidden sm:table-cell">Tor.</th>
                <th className="py-3 px-3 text-right font-semibold hidden md:table-cell">Top-5</th>
                <th className="py-3 px-3 text-right font-semibold hidden md:table-cell">Hàndicap</th>
                <th className="py-3 pl-2 pr-4 text-right font-semibold w-10"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rankedPlayers.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => onSelectMember(p)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer group"
                >
                  <td className="py-3 pl-5 pr-3 font-mono-tabular font-bold text-slate-900">
                    {p.om?.rank ?? '—'}
                  </td>
                  <td className="py-3 px-3">
                    <div className="font-semibold text-slate-900 group-hover:text-[#1c6d2c] transition-colors">
                      {p.displayName}
                    </div>
                    <div className="text-xs text-slate-500 font-mono-tabular">{p.license}</div>
                  </td>
                  <td className="py-3 px-3 text-right font-mono-tabular font-bold text-slate-900">
                    {p.om?.points ?? 0}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-600 hidden sm:table-cell">
                    {p.om?.tournaments ?? p.roundsPlayed}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-slate-600 hidden md:table-cell">
                    {p.om?.top5 ?? 0}
                  </td>
                  <td className="py-3 px-3 text-right font-mono-tabular text-slate-700 hidden md:table-cell">
                    {p.currentHandicap !== null ? formatCatalanNumber(p.currentHandicap) : '—'}
                  </td>
                  <td className="py-3 pl-2 pr-4 text-right text-slate-400 group-hover:text-slate-700">
                    <ChevronRight className="w-4 h-4 inline-block" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
