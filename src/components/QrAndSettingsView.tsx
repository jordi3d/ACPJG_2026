import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Download, RefreshCw, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { SeasonConfig } from '../lib/golfData';

interface QrAndSettingsViewProps {
  config: SeasonConfig;
  playerCount: number;
  activeTournamentsCount: number;
  onConfigSaved: () => Promise<void>;
}

export const QrAndSettingsView: React.FC<QrAndSettingsViewProps> = ({
  config,
  playerCount,
  activeTournamentsCount,
  onConfigSaved,
}) => {
  const [targetUrl, setTargetUrl] = useState(() => window.location.origin);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const [season, setSeason] = useState(config.season);
  const [sourceMode, setSourceMode] = useState<'default-2026' | 'live-sheets'>(config.sourceMode);
  const [resultsSheetUrl, setResultsSheetUrl] = useState(config.resultsSheetUrl);
  const [omSheetUrl, setOmSheetUrl] = useState(config.omSheetUrl);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    setSeason(config.season);
    setSourceMode(config.sourceMode);
    setResultsSheetUrl(config.resultsSheetUrl);
    setOmSheetUrl(config.omSheetUrl);
  }, [config]);

  useEffect(() => {
    let active = true;
    const urlToEncode = targetUrl.trim() || window.location.origin;
    QRCode.toDataURL(urlToEncode, {
      width: 480,
      margin: 2,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((dataUrl) => {
        if (active) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (active) setQrDataUrl('');
      });
    return () => {
      active = false;
    };
  }, [targetUrl]);

  const handleDownloadQrPoster = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = 900;
    canvas.height = 1180;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clean poster layout for gala lunch tables
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#84cf63';
    ctx.fillRect(0, 0, canvas.width, 210);

    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = '800 44px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(`Resultats Temporada ${season}`, 450, 95);
    ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('ACPJG – Associació Catalana de Periodistes Jugadors de Golf', 450, 148);

    // Draw QR
    if (qrDataUrl) {
      const qrImg = new Image();
      qrImg.src = qrDataUrl;
      await new Promise((res) => {
        qrImg.onload = res;
        qrImg.onerror = res;
      });
      ctx.drawImage(qrImg, 210, 260, 480, 480);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 32px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Escaneja el codi QR amb el mòbil', 450, 800);
    ctx.fillStyle = '#475569';
    ctx.font = '500 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Introdueix el teu nom o número de llicència', 450, 845);
    ctx.fillText('per consultar el teu resum personalitzat.', 450, 880);

    // Logo & Domain
    const logo = new Image();
    logo.src = '/assets/aistudio/logoweb_cf2208fb.png';
    await new Promise((res) => {
      logo.onload = res;
      logo.onerror = res;
    });
    if (logo.complete && logo.naturalWidth > 0) {
      ctx.drawImage(logo, 395, 930, 110, 110);
    }

    ctx.fillStyle = '#0f172a';
    ctx.font = '800 30px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('PeriodistesGolf.cat', 450, 1090);

    const link = document.createElement('a');
    link.download = `ACPJG_Cartell_QR_${season}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season,
          sourceMode,
          resultsSheetUrl,
          omSheetUrl,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Error guardant la configuració');
      }
      await onConfigSaved();
      setFeedback({
        type: 'success',
        message:
          sourceMode === 'live-sheets'
            ? `Connectat en temps real als fulls de Google de la temporada ${season}.`
            : `Configuració actualitzada per a la temporada ${season}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error inesperat',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRestore2026 = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          season: '2026',
          sourceMode: 'default-2026',
          resultsSheetUrl: '',
          omSheetUrl: '',
        }),
      });
      if (!res.ok) throw new Error('Error restaurant la temporada 2026');
      await onConfigSaved();
      setFeedback({
        type: 'success',
        message: 'Restaurades les dades oficials integrades de la temporada 2026.',
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err instanceof Error ? err.message : 'Error inesperat',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Left: Gala Lunch QR Code Generator */}
      <section className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 flex flex-col items-center text-center">
        <h2 className="text-xl font-bold text-slate-950">Codi QR per al Dinar de Gala</h2>
        <p className="text-sm text-slate-500 mt-1 max-w-sm">
          Els socis només han d’escanejar aquest codi amb el telèfon i escriure el seu nom o llicència.
        </p>

        <div className="my-6 p-4 bg-white border border-slate-200 rounded-xl">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Codi QR d'accés als resultats ACPJG"
              className="w-56 h-56 object-contain"
            />
          ) : (
            <div className="w-56 h-56 flex items-center justify-center text-sm text-slate-400">
              Generant QR...
            </div>
          )}
        </div>

        <div className="w-full text-left mb-4">
          <label htmlFor="qr-url" className="block text-xs font-semibold text-slate-600 mb-1.5">
            URL de destinació del codi QR
          </label>
          <input
            id="qr-url"
            type="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full min-h-[44px] px-3 py-2 text-xs font-mono-tabular bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#54a425]"
          />
        </div>

        <button
          type="button"
          onClick={handleDownloadQrPoster}
          className="w-full min-h-[46px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <Download className="w-4 h-4" />
          <span>Descarregar cartell QR imprimible (PNG)</span>
        </button>
      </section>

      {/* Right: Season & 2027 Google Sheets Live Sync */}
      <section className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-wrap items-start justify-between gap-2 pb-4 border-b border-slate-200">
          <div>
            <h2 className="text-xl font-bold text-slate-950">Configuració de Temporada i Google Sheets</h2>
            <p className="text-sm text-slate-500 mt-1">
              Prepara l’app per a la temporada 2027 en temps real des del primer torneig.
            </p>
          </div>
          <div className="text-right text-xs text-slate-500 tabular-nums">
            <div>{playerCount} socis carregats</div>
            <div>{activeTournamentsCount} proves amb dades</div>
          </div>
        </div>

        <form onSubmit={handleSaveConfig} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="season-year" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Any de la Temporada
              </label>
              <input
                id="season-year"
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                placeholder="2027"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm font-mono-tabular bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#54a425]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">Font de dades</label>
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setSourceMode('default-2026')}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    sourceMode === 'default-2026'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Base 2026
                </button>
                <button
                  type="button"
                  onClick={() => setSourceMode('live-sheets')}
                  className={`min-h-[36px] px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                    sourceMode === 'live-sheets'
                      ? 'bg-white text-slate-950 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Google Sheets
                </button>
              </div>
            </div>
          </div>

          {sourceMode === 'live-sheets' && (
            <div className="space-y-4 pt-1">
              <div>
                <label htmlFor="results-url" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enllaç públic de Google Sheets · Resultats i Hàndicaps
                </label>
                <input
                  id="results-url"
                  type="url"
                  required
                  value={resultsSheetUrl}
                  onChange={(e) => setResultsSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#54a425]"
                />
              </div>

              <div>
                <label htmlFor="om-url" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Enllaç públic de Google Sheets · Ordre de Mèrit (OM)
                </label>
                <input
                  id="om-url"
                  type="url"
                  required
                  value={omSheetUrl}
                  onChange={(e) => setOmSheetUrl(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/.../edit?usp=sharing"
                  className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#54a425]"
                />
              </div>

              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-600 space-y-1.5">
                <p className="font-semibold text-slate-800">Com preparar la temporada 2027 en temps real:</p>
                <p>
                  1. Comparteix els dos fulls de Google amb accés públic de lectura (<em>"Qualsevol usuari amb l’enllaç"</em>) o publica’ls al web.
                </p>
                <p>
                  2. Mantén les mateixes columnes base (<code className="font-mono-tabular">Llicència, Nom, Voltes, ...tornejos..., Eagles, Birdies, Pars, Bogeys, DBogeys, TBogeys+, Ratlles, Forats</code> i <code className="font-mono-tabular">RYDER, NOM, PUNTS, Tor., 1er, 2on, 3er, Top-5, Top-10</code>).
                </p>
                <p>
                  3. Des del primer torneig que s’introdueixi al full, l’app mostrarà automàticament els resultats d’aquella prova i anirà acumulant les següents en temps real.
                </p>
              </div>
            </div>
          )}

          {feedback && (
            <div
              role="status"
              className={`p-3.5 rounded-lg border text-sm flex items-start gap-2.5 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-red-50 border-red-200 text-red-900'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={handleRestore2026}
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-lg text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Restaurar dades 2026</span>
            </button>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-[#1c6d2c] hover:bg-[#165823] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${saving ? 'animate-spin' : ''}`} />
              <span>{saving ? 'Validant i desant...' : 'Desar i actualitzar dades'}</span>
            </button>
          </div>
        </form>
      </section>
    </div>
  );
};
