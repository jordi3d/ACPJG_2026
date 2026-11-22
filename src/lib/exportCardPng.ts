import { HOLE_SLICE_CONFIG } from '../components/PieChart3D';
import { formatCatalanNumber, MemberPerformance } from './golfData';

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

export async function downloadMemberCardPng(member: MemberPerformance, season: string): Promise<void> {
  const W = 1600;
  const H = 900;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // White base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, W, H);

  // Left green column (matching Sample.png)
  const leftW = 600;
  ctx.fillStyle = '#84cf63';
  ctx.fillRect(0, 0, leftW, H);

  // Member name & license
  ctx.fillStyle = '#0f172a';
  ctx.textAlign = 'center';
  ctx.font = '500 32px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(member.displayName, leftW / 2, 74, leftW - 48);

  ctx.font = '700 28px "JetBrains Mono", monospace';
  ctx.fillText(member.license, leftW / 2, 118);

  // OM Summary Table
  const om = member.om;
  const rows: [string, string][] = [
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

  const tableW = 246;
  const col1W = 120;
  const rowH = 40;
  const tableX = (leftW - tableW) / 2;
  const tableY = 175;

  rows.forEach(([label, val], idx) => {
    const y = tableY + idx * rowH;
    ctx.fillStyle = '#bcbcbc';
    ctx.fillRect(tableX, y, col1W, rowH);
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(tableX + col1W, y, tableW - col1W, rowH);

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.strokeRect(tableX, y, col1W, rowH);
    ctx.strokeRect(tableX + col1W, y, tableW - col1W, rowH);

    ctx.fillStyle = '#0f172a';
    ctx.font = '700 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(label, tableX + col1W / 2, y + 28);

    ctx.font = '500 24px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(val, tableX + col1W + (tableW - col1W) / 2, y + 28);
  });

  // Golf ball logo (logoweb.png)
  try {
    const logo = await loadImage('/assets/aistudio/logoweb_cf2208fb.png');
    const logoSize = 158;
    ctx.drawImage(logo, (leftW - logoSize) / 2, 588, logoSize, logoSize);
  } catch {
    // Graceful skip if image fails
  }

  // PeriodistesGolf.cat below logo
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 36px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('PeriodistesGolf.cat', leftW / 2, 804);

  ctx.font = '500 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('ACPJG – Associació Catalana de Periodistes Jugadors de Golf', leftW / 2, 846, leftW - 36);

  // Right white panels border
  const rightX = leftW + 14;
  const rightW = W - rightX - 14;
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.strokeRect(rightX, 14, rightW, 616);
  ctx.strokeRect(rightX, 638, rightW, 248);

  // Title Resultats {season}
  ctx.fillStyle = '#0f172a';
  ctx.font = '700 34px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(`Resultats ${season}`, rightX + rightW / 2, 66);

  // Draw 3D Pie on Canvas
  const slices = HOLE_SLICE_CONFIG.map((cfg) => ({
    ...cfg,
    value: member.holeResults[cfg.key] || 0,
  }));
  const total = slices.reduce((acc, s) => acc + s.value, 0);
  const pieCx = rightX + rightW / 2;
  const pieCy = 290;
  const pieRx = 315;
  const pieRy = 158;
  const pieDepth = 42;

  if (total > 0) {
    let angle = -Math.PI / 2;
    const computed = slices.map((s) => {
      const sweep = (s.value / total) * Math.PI * 2;
      const start = angle;
      const end = angle + sweep;
      angle = end;
      return { ...s, start, end, mid: (start + end) / 2, pct: (s.value / total) * 100 };
    });

    // Side walls (stepped polygon for crisp elliptical extrusion)
    for (const s of computed) {
      if (s.value <= 0) continue;
      const frontRanges: [number, number][] = [
        [0, Math.PI],
        [Math.PI * 2, Math.PI * 3],
      ];
      for (const [fStart, fEnd] of frontRanges) {
        const a = Math.max(s.start, fStart);
        const b = Math.min(s.end, fEnd);
        if (b - a <= 0.001) continue;
        const steps = Math.max(8, Math.ceil(((b - a) / Math.PI) * 32));
        ctx.beginPath();
        for (let i = 0; i <= steps; i++) {
          const th = a + ((b - a) * i) / steps;
          const x = pieCx + pieRx * Math.cos(th);
          const y = pieCy + pieRy * Math.sin(th);
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        for (let i = steps; i >= 0; i--) {
          const th = a + ((b - a) * i) / steps;
          const x = pieCx + pieRx * Math.cos(th);
          const y = pieCy + pieDepth + pieRy * Math.sin(th);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fillStyle = s.sideColor;
        ctx.fill();
      }
    }

    // Top slices
    for (const s of computed) {
      if (s.value <= 0) continue;
      const steps = Math.max(12, Math.ceil(((s.end - s.start) / (Math.PI * 2)) * 64));
      ctx.beginPath();
      ctx.moveTo(pieCx, pieCy);
      for (let i = 0; i <= steps; i++) {
        const th = s.start + ((s.end - s.start) * i) / steps;
        ctx.lineTo(pieCx + pieRx * Math.cos(th), pieCy + pieRy * Math.sin(th));
      }
      ctx.closePath();
      ctx.fillStyle = s.color;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Labels
    for (const s of computed) {
      if (s.value === 0) continue;
      const isSmall = s.pct < 5.5;
      const rf = isSmall ? 1.13 : 0.64;
      const lx = pieCx + pieRx * rf * Math.cos(s.mid) + (s.key === 'birdies' && isSmall ? 14 : 0);
      const ly = pieCy + pieRy * rf * Math.sin(s.mid) + (isSmall ? -6 : 9);
      const isDark = s.key === 'ratlles' || s.key === 'eagles' || s.key === 'dbogeys';
      ctx.fillStyle = isSmall ? '#0f172a' : isDark ? '#ffffff' : '#0f172a';
      ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText(String(s.value), lx, ly);
    }

    if (member.holeResults.eagles === 0) {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 26px "Plus Jakarta Sans", system-ui, sans-serif';
      ctx.fillText('0', pieCx - 16, pieCy - pieRy - 16);
    }
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '500 22px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Sense forats registrats aquesta temporada', pieCx, pieCy);
  }

  // Legend
  ctx.font = '600 20px "Plus Jakarta Sans", system-ui, sans-serif';
  const legendItems = HOLE_SLICE_CONFIG.map((c) => c.label);
  const totalLegW = legendItems.reduce((sum, l) => sum + ctx.measureText(l).width + 44, 0) - 20;
  let legX = pieCx - totalLegW / 2;
  const legY = 586;
  ctx.textAlign = 'left';
  HOLE_SLICE_CONFIG.forEach((c) => {
    ctx.fillStyle = c.color;
    ctx.fillRect(legX, legY - 14, 14, 14);
    ctx.fillStyle = '#0f172a';
    ctx.fillText(c.label, legX + 20, legY);
    legX += ctx.measureText(c.label).width + 44;
  });

  // Bottom Right: Evolució del Hàndicap
  ctx.textAlign = 'center';
  ctx.fillStyle = '#52525b';
  ctx.font = '600 24px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('Evolució del Hàndicap', rightX + rightW / 2, 674);

  const series = member.handicapSeries;
  if (series.length > 0) {
    const vals = series.map((d) => d.handicap);
    const rMin = Math.min(...vals);
    const rMax = Math.max(...vals);
    let yMin = Math.floor((rMin - 0.4) * 2) / 2;
    let yMax = Math.ceil((rMax + 0.4) * 2) / 2;
    if (yMax - yMin < 1.5) {
      const mid = Math.round(((rMin + rMax) / 2) * 2) / 2;
      yMin = mid - 1;
      yMax = mid + 1;
    }

    const gx = rightX + 68;
    const gy = 696;
    const gw = rightW - 96;
    const gh = 142;

    const getX = (i: number) => (series.length === 1 ? gx + gw / 2 : gx + (i / (series.length - 1)) * gw);
    const getY = (v: number) => gy + gh - ((v - yMin) / (yMax - yMin || 1)) * gh;

    const step = yMax - yMin <= 3 ? 0.5 : yMax - yMin <= 7 ? 1 : 2;
    ctx.textAlign = 'right';
    ctx.font = '500 15px "Plus Jakarta Sans", system-ui, sans-serif';
    for (let v = Math.ceil(yMin / step) * step; v <= yMax + 0.001; v += step) {
      const tv = Math.round(v * 10) / 10;
      const y = getY(tv);
      ctx.strokeStyle = '#d4d4d8';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + gw, y);
      ctx.stroke();
      ctx.fillStyle = '#52525b';
      ctx.fillText(formatCatalanNumber(tv), gx - 10, y + 5);
    }

    if (series.length >= 2) {
      const n = series.length;
      let sx = 0, sy = 0, sxy = 0, sxx = 0;
      for (let i = 0; i < n; i++) {
        sx += i; sy += vals[i]; sxy += i * vals[i]; sxx += i * i;
      }
      const denom = n * sxx - sx * sx;
      const slope = denom !== 0 ? (n * sxy - sx * sy) / denom : 0;
      const intercept = (sy - slope * sx) / n;
      ctx.save();
      ctx.setLineDash([3, 6]);
      ctx.strokeStyle = 'rgba(22, 83, 126, 0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(getX(0), getY(intercept));
      ctx.lineTo(getX(n - 1), getY(intercept + slope * (n - 1)));
      ctx.stroke();
      ctx.restore();

      ctx.strokeStyle = '#16537e';
      ctx.lineWidth = 3.5;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      series.forEach((pt, i) => {
        if (i === 0) ctx.moveTo(getX(i), getY(pt.handicap));
        else ctx.lineTo(getX(i), getY(pt.handicap));
      });
      ctx.stroke();
    } else {
      ctx.fillStyle = '#16537e';
      ctx.beginPath();
      ctx.arc(getX(0), getY(series[0].handicap), 7, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.textAlign = 'center';
    ctx.fillStyle = '#52525b';
    ctx.font = '500 14px "Plus Jakarta Sans", system-ui, sans-serif';
    series.forEach((pt, i) => {
      if (series.length <= 22 || i % 2 === 0 || i === series.length - 1) {
        ctx.fillText(series.length === 1 ? pt.tournament : String(pt.index), getX(i), gy + gh + 22);
      }
    });
  }

  const link = document.createElement('a');
  link.download = `ACPJG_${season}_${member.license}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
