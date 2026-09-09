/* ===== Dariowhere — lettura dei metadati EXIF di un JPEG =====

   Legge solo quello che serve: coordinate GPS, data dello scatto e orientamento.
   Nessuna dipendenza: si scorrono i marker JPEG fino al blocco APP1 "Exif", poi si
   interpreta la struttura TIFF che contiene le directory IFD0, Exif e GPS.

   Va chiamata sul file originale, PRIMA del ridimensionamento su canvas: la
   ricodifica cancella tutti i metadati. */

window.DWExif = (function () {
  'use strict';

  /* dimensione in byte dei tipi TIFF, indicizzata dal codice di tipo */
  const TYPE_SIZE = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };

  const TAG = {
    ORIENTATION: 0x0112,
    EXIF_IFD: 0x8769,
    GPS_IFD: 0x8825,
    DATE_ORIGINAL: 0x9003,
    DATE_DIGITIZED: 0x9004,
    DATE_TIME: 0x0132,
    GPS_LAT_REF: 0x0001,
    GPS_LAT: 0x0002,
    GPS_LON_REF: 0x0003,
    GPS_LON: 0x0004
  };

  function ascii(view, offset, length) {
    let s = '';
    for (let i = 0; i < length; i++) {
      const c = view.getUint8(offset + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  /* Trova il blocco APP1 "Exif" e restituisce l'offset dell'header TIFF.
     Ritorna -1 se non c'è, -2 se il buffer è finito prima (segmento più lungo di
     quanto abbiamo letto: capita con profili ICC o anteprime molto grandi). */
  function findTiffStart(view) {
    let off = 2;
    while (off + 4 <= view.byteLength) {
      if (view.getUint8(off) !== 0xFF) return -1;                          // marker disallineato
      const marker = view.getUint8(off + 1);

      if (marker === 0xDA) return -1;                                      // inizio immagine, EXIF assente
      if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { off += 2; continue; }

      const size = view.getUint16(off + 2);
      if (size < 2) return -1;

      if (marker === 0xE1 && off + 10 <= view.byteLength && ascii(view, off + 4, 4) === 'Exif') {
        return off + 10;
      }
      off += 2 + size;
    }
    return off + 4 > view.byteLength && off < 0xFFFFFFFF ? -2 : -1;
  }

  /* Legge una directory IFD e restituisce una mappa tag → descrittore della voce. */
  function readIfd(view, base, offset, little) {
    const entries = new Map();
    if (offset + 2 > view.byteLength) return entries;

    const count = view.getUint16(offset, little);
    for (let i = 0; i < count; i++) {
      const e = offset + 2 + i * 12;
      if (e + 12 > view.byteLength) break;

      const tag = view.getUint16(e, little);
      const type = view.getUint16(e + 2, little);
      const num = view.getUint32(e + 4, little);
      const size = (TYPE_SIZE[type] || 0) * num;
      if (!size) continue;

      // fino a 4 byte il valore sta nella voce stessa, altrimenti c'è un puntatore
      const at = size <= 4 ? e + 8 : base + view.getUint32(e + 8, little);
      if (at < 0 || at + size > view.byteLength) continue;

      entries.set(tag, { type, num, at });
    }
    return entries;
  }

  function rational(view, at, little) {
    const num = view.getUint32(at, little);
    const den = view.getUint32(at + 4, little);
    return den ? num / den : 0;
  }

  /* gradi, minuti, secondi → gradi decimali */
  function dms(view, entry, little) {
    if (!entry || (entry.type !== 5 && entry.type !== 10) || entry.num < 2) return null;
    const d = rational(view, entry.at, little);
    const m = rational(view, entry.at + 8, little);
    const s = entry.num > 2 ? rational(view, entry.at + 16, little) : 0;
    return d + m / 60 + s / 3600;
  }

  function dateOf(view, entry) {
    if (!entry || entry.type !== 2) return '';
    // formato EXIF: "2025:03:22 18:41:07"
    const raw = ascii(view, entry.at, Math.min(entry.num, 20));
    const m = /^(\d{4}):(\d{2}):(\d{2})/.exec(raw);
    return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
  }

  /* Quanto file leggere in cerca dell'APP1. Sta quasi sempre nei primi KB, ma prima
     di esso possono trovarsi profili ICC (APP2) o anteprime grandi: con un buffer
     troppo corto lo scorrimento dei marker finisce fuori e l'EXIF sembra assente. */
  const BYTE_DA_LEGGERE = 4 * 1024 * 1024;

  /* Legge i metadati. Ritorna sempre un oggetto; i campi assenti sono null o vuoti.

     Il campo `reason` dice com'è andata, e serve a distinguere due situazioni che
     dall'esterno sembrano identiche:
       'ok'          coordinate trovate
       'exif-no-gps' la foto ha l'EXIF (spesso con la data) ma nessun GPS: è il caso
                     tipico di Android, che rimuove la posizione dalle foto passate
                     al browser tramite il selettore di sistema
       'exif-vuoto'  EXIF presente ma senza data né GPS
       'no-exif'     nessun blocco EXIF
       'non-jpeg'    non è un JPEG (HEIC, PNG, WebP: nessun EXIF leggibile qui)
       'troncato'    l'EXIF potrebbe essere oltre i byte letti                    */
  async function read(file) {
    const out = { lat: null, lng: null, date: '', orientation: 1, reason: 'no-exif' };
    if (!file) { out.reason = 'no-file'; return out; }

    let view;
    try {
      const quanti = Math.min(file.size || BYTE_DA_LEGGERE, BYTE_DA_LEGGERE);
      view = new DataView(await file.slice(0, quanti).arrayBuffer());
    } catch (e) {
      out.reason = 'illeggibile';
      return out;
    }

    /* Il tipo MIME non viene usato come filtro: su Android può arrivare vuoto o
       generico anche per un JPEG. Conta la firma nei primi due byte. */
    if (view.byteLength < 4 || view.getUint16(0) !== 0xFFD8) {
      out.reason = 'non-jpeg';
      return out;
    }

    const base = findTiffStart(view);
    if (base === -2) { out.reason = 'troncato'; return out; }
    if (base < 0 || base + 8 > view.byteLength) { out.reason = 'no-exif'; return out; }

    const little = ascii(view, base, 2) === 'II';
    if (view.getUint16(base + 2, little) !== 0x2A) { out.reason = 'no-exif'; return out; }

    const ifd0 = readIfd(view, base, base + view.getUint32(base + 4, little), little);

    const orient = ifd0.get(TAG.ORIENTATION);
    if (orient && orient.type === 3) {
      const v = view.getUint16(orient.at, little);
      if (v >= 1 && v <= 8) out.orientation = v;
    }

    const exifPtr = ifd0.get(TAG.EXIF_IFD);
    if (exifPtr) {
      const exif = readIfd(view, base, base + view.getUint32(exifPtr.at, little), little);
      out.date = dateOf(view, exif.get(TAG.DATE_ORIGINAL) || exif.get(TAG.DATE_DIGITIZED));
    }
    if (!out.date) out.date = dateOf(view, ifd0.get(TAG.DATE_TIME));

    const gpsPtr = ifd0.get(TAG.GPS_IFD);
    if (gpsPtr) {
      const gps = readIfd(view, base, base + view.getUint32(gpsPtr.at, little), little);

      const lat = dms(view, gps.get(TAG.GPS_LAT), little);
      const lng = dms(view, gps.get(TAG.GPS_LON), little);

      if (lat !== null && lng !== null) {
        const refLat = gps.get(TAG.GPS_LAT_REF);
        const refLon = gps.get(TAG.GPS_LON_REF);
        const latRef = (refLat ? ascii(view, refLat.at, 1) : 'N').toUpperCase() || 'N';
        const lonRef = (refLon ? ascii(view, refLon.at, 1) : 'E').toUpperCase() || 'E';

        const signedLat = latRef === 'S' ? -lat : lat;
        const signedLng = lonRef === 'W' ? -lng : lng;

        // 0,0 è quasi sempre un GPS senza fix, non l'isola nel golfo di Guinea
        if (Math.abs(signedLat) <= 90 && Math.abs(signedLng) <= 180
            && (Math.abs(signedLat) > 0.0001 || Math.abs(signedLng) > 0.0001)) {
          out.lat = signedLat;
          out.lng = signedLng;
        }
      }
    }

    out.reason = out.lat !== null ? 'ok' : (out.date ? 'exif-no-gps' : 'exif-vuoto');
    return out;
  }

  return { read };
})();
