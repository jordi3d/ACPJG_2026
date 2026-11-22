import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Download, ArrowLeft, Share2 } from 'lucide-react';
import { formatCatalanNumber, MemberPerformance } from '../lib/golfData';
import { downloadMemberCardPng } from '../lib/exportCardPng';
import { PieChart3D } from './PieChart3D';
import { HandicapChart } from './HandicapChart';

interface MemberReportCardProps {
  member: MemberPerformance;
  season: string;
  onBack: () => void;
}

export const MemberReportCard: React.FC<MemberReportCardProps> = ({ member, season, onBack }) => {
  const [showTournaments, setShowTournaments] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const om = member.om;
  const omRows: [string, string][] = [
    ['OM', om?.rank ? String(om.rank) : '—'],
    ['Ryder', om?.ryder || 'NO'],
    ['Punts', om ? String(om.points) : '0'],
    ['Tor.', om ? String(om.tournaments) : String(member.roundsPlayed)],
    ['1er', om ? String(om.first) : '0'],
    ['2on', om ? String(om.second) : '0'],
    ['3er', om ? String(om.third) : '0'],
    ['Top-5', om ? String(om.top5) : '0'],
    ['Top-10', om ? String(om.top10) : '0'],
  ];

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadMemberCardPng(member, season);
    } finally {
      setDownloading(false);
    }
  };

  const handleShareLink = async () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?q=${encodeURIComponent(member.license)}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${member.displayName} · Resultats ${season} ACPJG`,
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2500);
      }
    } catch {
      // User cancelled share
    }
  };

  const playedOmTournaments = (om?.tournamentPoints || []).filter(
    (tp) => tp.points !== null && tp.points !== 0 && tp.points !== '0'
  );

  return (
    <div className="space-y-5">
      {/* Top Action Strip */}
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Cercar un altre soci</span>
        </button>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleShareLink}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-950 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Share2 className="w-4 h-4" />
            <span>{copiedLink ? 'Enllaç copiat' : 'Compartir enllaç'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloading ? 'Generant PNG...' : 'Descarregar targeta (PNG)'}</span>
          </button>
        </div>
      </div>

      {/* Main Personalized Report Card — Faithful to Sample.png */}
      <article
        aria-label={`Resum de temporada de ${member.displayName}`}
        className="w-full bg-white border border-slate-200 overflow-hidden shadow-sm grid grid-cols-1 lg:grid-cols-12"
      >
        {/* Left Green Panel */}
        <div className="lg:col-span-5 bg-[#84cf63] px-5 py-7 sm:px-8 sm:py-8 flex flex-col items-center justify-between text-center text-slate-950">
          {/* Identity */}
          <div className="w-full">
            <h1 className="text-xl sm:text-2xl font-medium tracking-tight text-slate-950 leading-snug text-balance">
              {member.displayName}
            </h1>
            <p className="mt-1 text-lg sm:text-xl font-bold font-mono-tabular tracking-wide text-slate-950">
              {member.license}
            </p>
          </div>

          {/* OM Summary Table */}
          <div className="w-full max-w-[240px] my-6 border border-white/80">
            <table className="w-full border-collapse text-base sm:text-lg">
              <tbody>
                {omRows.map(([label, val]) => (
                  <tr key={label} className="border-b border-white last:border-b-0">
                    <th
                      scope="row"
                      className="w-1/2 bg-[#bcbcbc] text-slate-950 font-bold py-1 px-3 text-center border-r border-white"
                    >
                      {label}
                    </th>
                    <td className="w-1/2 bg-[#f2f2f2] text-slate-950 font-medium py-1 px-3 text-center tabular-nums">
                      {val}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Brand Footer: Replaced 35 logo with logoweb.png + PeriodistesGolf.cat */}
          <div className="flex flex-col items-center mt-2">
            <div className="w-28 h-28 sm:w-32 sm:h-32 flex items-center justify-center">
              <img
                src="/assets/aistudio/logoweb_cf2208fb.png"
                alt="Logo PeriodistesGolf.cat"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain drop-shadow-sm"
              />
            </div>
            <p className="mt-2 text-2xl font-extrabold tracking-tight text-slate-950">
              PeriodistesGolf.cat
            </p>
            <p className="mt-1 text-xs sm:text-[13px] font-medium text-slate-950/90 leading-snug max-w-[320px]">
              ACPJG – Associació Catalana de Periodistes Jugadors de Golf
            </p>
          </div>
        </div>

        {/* Right White Panel */}
        <div className="lg:col-span-7 bg-white p-3 sm:p-4 flex flex-col gap-3">
          {/* Top Box: Resultats {season} */}
          <section className="border border-slate-200 px-4 pt-5 pb-5 flex flex-col items-center justify-center flex-1">
            <h2 className="text-2xl sm:text-[28px] font-bold tracking-tight text-slate-950 mb-2">
              Resultats {season}
            </h2>
            <PieChart3D results={member.holeResults} />
          </section>

          {/* Bottom Box: Evolució del Hàndicap */}
          <section className="border border-slate-200 px-4 pt-4 pb-3">
            <h2 className="text-base sm:text-lg font-medium text-slate-600 text-center mb-2">
              Evolució del Hàndicap
            </h2>
            <HandicapChart series={member.handicapSeries} />
          </section>
        </div>
      </article>

      {/* Expandable Tournament-by-Tournament Breakdown */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden no-print">
        <button
          type="button"
          onClick={() => setShowTournaments((prev) => !prev)}
          className="w-full min-h-[52px] px-5 py-3.5 flex items-center justify-between text-left hover:bg-slate-50 transition-colors cursor-pointer"
        >
          <div>
            <span className="text-sm font-semibold text-slate-900">
              Detall de voltes i punts per torneig ({member.handicapSeries.length} voltes)
            </span>
            <p className="text-xs text-slate-500 mt-0.5">
              Consulta el hàndicap de joc en cada prova i els punts sumats a l’Ordre de Mèrit
            </p>
          </div>
          {showTournaments ? (
            <ChevronUp className="w-5 h-5 text-slate-500 shrink-0" />
          ) : (
            <ChevronDown className="w-5 h-5 text-slate-500 shrink-0" />
          )}
        </button>

        {showTournaments && (
          <div className="border-t border-slate-200 grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
            {/* Handicap per round */}
            <div className="p-5">
              <h3 className="text-xs font-semibold text-slate-500 tracking-wide mb-3">
                Hàndicap per volta disputada
              </h3>
              {member.handicapSeries.length === 0 ? (
                <p className="text-sm text-slate-500">Cap volta registrada.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-2 pr-2 font-medium">#</th>
                        <th className="py-2 px-2 font-medium">Camp / Prova</th>
                        <th className="py-2 pl-2 font-medium text-right">Hàndicap</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {member.handicapSeries.map((pt) => (
                        <tr key={`${pt.index}-${pt.tournament}`} className="hover:bg-slate-50">
                          <td className="py-2 pr-2 text-slate-400 tabular-nums">{pt.index}</td>
                          <td className="py-2 px-2 text-slate-800 font-medium">{pt.tournament}</td>
                          <td className="py-2 pl-2 text-right font-mono-tabular font-semibold text-slate-900">
                            {formatCatalanNumber(pt.handicap)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* OM points per tournament */}
            <div className="p-5">
              <h3 className="text-xs font-semibold text-slate-500 tracking-wide mb-3">
                Punts Ordre de Mèrit per torneig
              </h3>
              {playedOmTournaments.length === 0 ? (
                <p className="text-sm text-slate-500">Cap puntuació registrada a l’Ordre de Mèrit.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                        <th className="py-2 pr-2 font-medium">Torneig</th>
                        <th className="py-2 pl-2 font-medium text-right">Punts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {playedOmTournaments.map((tp) => (
                        <tr key={tp.tournament} className="hover:bg-slate-50">
                          <td className="py-2 pr-2 text-slate-800">{tp.tournament}</td>
                          <td className="py-2 pl-2 text-right font-mono-tabular font-semibold text-slate-900">
                            {tp.points}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
