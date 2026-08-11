/* Sette sticker di esempio, con le foto segnaposto statiche in /photos.
   Servono solo a vedere la mappa popolata appena il sito è online: si caricano
   dalla pagina admin e si possono cancellare uno per uno quando non servono più. */

export const SEED = [
  {
    id: 'demo-berlino-mauerpark',
    title: 'Mauerpark',
    description: 'Attaccato su un lampione dietro il palco del karaoke, domenica pomeriggio.',
    author: 'Dario', lat: 52.54126, lng: 13.40415,
    photo_url: '/photos/berlino-mauerpark.svg',
    taken_on: '2023-06-11', place: 'Mauerpark', country: 'Germania', country_code: 'DE',
    tags: ['lampione', 'street art']
  },
  {
    id: 'demo-lisbona-alfama',
    title: 'Scalinata di Alfama',
    description: 'Sul contatore elettrico giallo a metà della salita, quello con vista sul Tejo.',
    author: 'Giulia', lat: 38.71223, lng: -9.13011,
    photo_url: '/photos/lisbona-alfama.svg',
    taken_on: '2023-09-02', place: 'Alfama, Lisbona', country: 'Portogallo', country_code: 'PT',
    tags: ['azulejos', 'salita']
  },
  {
    id: 'demo-tokyo-shibuya',
    title: 'Shibuya Crossing',
    description: 'Retro del cartello pedonale all uscita Hachiko, tre semafori per trovare il momento giusto.',
    author: 'Dario', lat: 35.65947, lng: 139.70057,
    photo_url: '/photos/tokyo-shibuya.svg',
    taken_on: '2024-02-18', place: 'Shibuya, Tokyo', country: 'Giappone', country_code: 'JP',
    tags: ['neon', 'incrocio']
  },
  {
    id: 'demo-nyc-williamsburg',
    title: 'Bedford Avenue',
    description: 'Palo della segnaletica davanti al bar dei bagel. Coperto da un altro sticker dopo un mese.',
    author: 'Marco', lat: 40.71427, lng: -73.96124,
    photo_url: '/photos/nyc-williamsburg.svg',
    taken_on: '2024-05-30', place: 'Williamsburg, Brooklyn', country: 'Stati Uniti', country_code: 'US',
    tags: ['palo', 'coperto']
  },
  {
    id: 'demo-reykjavik-hallgrim',
    title: 'Hallgrimskirkja',
    description: 'Sul cestino davanti alla chiesa. Il vento ha piegato un angolo ma tiene.',
    author: 'Dario', lat: 64.14184, lng: -21.92656,
    photo_url: '/photos/reykjavik-hallgrim.svg',
    taken_on: '2024-08-07', place: 'Reykjavik', country: 'Islanda', country_code: 'IS',
    tags: ['vento', 'chiesa']
  },
  {
    id: 'demo-bologna-portici',
    title: 'Portici di via Zamboni',
    description: 'Terza colonna dopo il bar, ad altezza occhi. Zona universitaria, densità sticker altissima.',
    author: 'Dario', lat: 44.49437, lng: 11.34331,
    photo_url: '/photos/bologna-portici.svg',
    taken_on: '2025-03-22', place: 'Bologna', country: 'Italia', country_code: 'IT',
    tags: ['portici', 'università']
  },
  {
    id: 'demo-valparaiso-cerro',
    title: 'Cerro Alegre',
    description: 'Muro dei murales, accanto all ascensore. Il posto più colorato dove sia finito uno sticker.',
    author: 'Ana', lat: -33.04516, lng: -71.62119,
    photo_url: '/photos/valparaiso-cerro.svg',
    taken_on: '2025-11-14', place: 'Valparaiso', country: 'Cile', country_code: 'CL',
    tags: ['murales', 'ascensore']
  }
];

