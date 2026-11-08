// The passport as a stamp album: one stamp per buurt, greyed until earned,
// the date under each earned one.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStampAlbum, stampDateLabel, type AlbumStamp, type StampSources } from '../stampAlbum.ts';
import { drawPlainStamp } from '../stampAlbumPlain.ts';
import { loadStampArt, stampArtNow } from '../stampArtLoader.ts';
import type { StampArt } from '../stampAlbumStamp.ts';
import { noteSession } from '../stampAlbumSession.ts';
import { useLanguage, useT } from '../../i18n/useT.ts';

/** Stamps shown before "All N stamps": two rows on a desktop, three on a phone. */
export const STAMP_ALBUM_FOLD = 12;
const CANVAS_PX = 208;

function StampCanvas({ stamp, art, fontReady }: { stamp: AlbumStamp; art: StampArt | null; fontReady: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, CANVAS_PX, CANVAS_PX);
    // Earned stamps get the postcard lettering; unearned ones stay the plain,
    // cheap stand-in (greyed by CSS) so a full album is not 90 compositor draws.
    if (stamp.earned && art) ctx.drawImage(art.buurtStampCanvas(stamp.name), 0, 0, CANVAS_PX, CANVAS_PX);
    else drawPlainStamp(ctx, stamp.name, CANVAS_PX);
  }, [stamp.name, stamp.earned, art, fontReady]);
  return <canvas ref={ref} width={CANVAS_PX} height={CANVAS_PX} aria-hidden="true" />;
}

export function StampAlbum({
  sources,
  buurtNames,
  fresh = null,
  fold = STAMP_ALBUM_FOLD,
}: {
  sources: StampSources;
  buurtNames: readonly string[];
  fresh?: string | null;
  fold?: number;
}) {
  const t = useT();
  const lang = useLanguage();
  const album = useMemo(() => buildStampAlbum(buurtNames, sources), [buurtNames, sources]);
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState<StampArt | null>(() => stampArtNow());
  useEffect(() => {
    if (art || !album.earned) return;
    let live = true;
    loadStampArt().then(loaded => { if (live && loaded) setArt(loaded); });
    return () => { live = false; };
  }, [art, album.earned]);
  // Lettering measured before the outline font lands is redrawn once it does.
  const [fontReady, setFontReady] = useState(false);
  useEffect(() => {
    if (!art) return;
    let live = true;
    art.loadStampFont().then(() => { if (live) setFontReady(true); }, () => {});
    return () => { live = false; };
  }, [art]);
  useEffect(() => { noteSession('stampsEarned', album.earned); }, [album.earned]);
  const shown = open ? album.stamps : album.stamps.slice(0, Math.max(fold, album.earned));
  const hidden = album.total - shown.length;
  return (
    <section className="stamp-album" aria-labelledby="stamp-album-title" data-testid="stamp-album" data-earned={album.earned} data-total={album.total}>
      <div className="stamp-album-head">
        <div>
          <h2 id="stamp-album-title">{t('stamps.title')}</h2>
          <p>{album.earned ? t('stamps.bodyEarned') : t('stamps.bodyEmpty')}</p>
        </div>
        <span className="stamp-album-count" aria-label={t('stamps.countAria', { earned: album.earned, total: album.total })}>{album.earned} / {album.total}</span>
      </div>
      <ul className="stamp-grid">
        {shown.map(stamp => (
          <li key={stamp.name}>
            <figure className="stamp" data-earned={stamp.earned} data-fresh={stamp.name === fresh}>
              <StampCanvas stamp={stamp} art={art} fontReady={fontReady} />
              <figcaption>
                <strong title={stamp.name}>{stamp.name}</strong>
                <span>{stamp.earned ? (stamp.name === fresh ? t('stamps.new') : stampDateLabel(stamp.date, lang) || t('stamps.stamped')) : t('stamps.notYet')}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className="stamp-album-more" onClick={() => setOpen(true)}>{t('stamps.all', { total: album.total })}</button>
      )}
    </section>
  );
}
