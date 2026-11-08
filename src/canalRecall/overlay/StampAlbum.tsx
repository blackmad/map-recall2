// The passport as a stamp album: one stamp per buurt, greyed until earned,
// the date under each earned one.
import { useEffect, useMemo, useRef, useState } from 'react';
import { buildStampAlbum, stampDateLabel, type AlbumStamp, type StampSources } from '../stampAlbum.ts';
import { drawPlainStamp } from '../stampAlbumPlain.ts';
import { loadStampArt, stampArtNow } from '../stampArtLoader.ts';
import type { StampArt } from '../stampAlbumStamp.ts';
import { noteSession } from '../stampAlbumSession.ts';

/** Stamps shown before "All N stamps": two rows on a desktop, three on a phone. */
export const STAMP_ALBUM_FOLD = 12;
const CANVAS_PX = 208;

function StampCanvas({ stamp, art }: { stamp: AlbumStamp; art: StampArt | null }) {
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
  }, [stamp.name, stamp.earned, art]);
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
  const album = useMemo(() => buildStampAlbum(buurtNames, sources), [buurtNames, sources]);
  const [open, setOpen] = useState(false);
  const [art, setArt] = useState<StampArt | null>(() => stampArtNow());
  useEffect(() => {
    if (art || !album.earned) return;
    let live = true;
    loadStampArt().then(loaded => { if (live && loaded) setArt(loaded); });
    return () => { live = false; };
  }, [art, album.earned]);
  useEffect(() => { noteSession('stampsEarned', album.earned); }, [album.earned]);
  const shown = open ? album.stamps : album.stamps.slice(0, Math.max(fold, album.earned));
  const hidden = album.total - shown.length;
  return (
    <section className="stamp-album" aria-labelledby="stamp-album-title" data-testid="stamp-album" data-earned={album.earned} data-total={album.total}>
      <div className="stamp-album-head">
        <div>
          <h2 id="stamp-album-title">Passport</h2>
          <p>{album.earned ? 'One stamp per buurt, earned by riding and naming it' : 'Know eight names, then ride into a buurt to earn its stamp'}</p>
        </div>
        <span className="stamp-album-count" aria-label={`${album.earned} of ${album.total} stamps`}>{album.earned} / {album.total}</span>
      </div>
      <ul className="stamp-grid">
        {shown.map(stamp => (
          <li key={stamp.name}>
            <figure className="stamp" data-earned={stamp.earned} data-fresh={stamp.name === fresh}>
              <StampCanvas stamp={stamp} art={art} />
              <figcaption>
                <strong title={stamp.name}>{stamp.name}</strong>
                <span>{stamp.earned ? (stamp.name === fresh ? 'New stamp' : stampDateLabel(stamp.date) || 'Stamped') : 'Not yet'}</span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
      {hidden > 0 && (
        <button type="button" className="stamp-album-more" onClick={() => setOpen(true)}>All {album.total} buurts</button>
      )}
    </section>
  );
}
