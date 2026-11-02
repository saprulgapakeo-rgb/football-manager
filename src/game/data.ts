// Semua nama di sini FIKTIF.
export const LEAGUE_NAME = 'Liga Eterna Premier';

export const FIRST_NAMES: Record<string, string[]> = {
  IDN: ['Raka', 'Bima', 'Dimas', 'Fajar', 'Galang', 'Yoga', 'Arya', 'Rendra', 'Satria', 'Ilham', 'Bagas', 'Wira'],
  BRA: ['Thiaguinho', 'Rafaelo', 'Caio', 'Davi', 'Murilo', 'Joaquim', 'Ederson', 'Lucão', 'Vinício', 'Renan'],
  ESP: ['Iker', 'Alvaro', 'Marcos', 'Unai', 'Pablo', 'Sergi', 'Adrián', 'Hugo', 'Jaime', 'Rubén'],
  ENG: ['Callum', 'Reece', 'Harvey', 'Jude', 'Mason', 'Owen', 'Declan', 'Tyler', 'Archie', 'Lewis'],
  FRA: ['Théo', 'Maxence', 'Kylian', 'Rayan', 'Bastien', 'Lucas', 'Noé', 'Enzo', 'Yanis', 'Mathis'],
  GER: ['Lukas', 'Jonas', 'Florian', 'Niklas', 'Timo', 'Leon', 'Malte', 'Felix', 'Jannik', 'Moritz'],
  ITA: ['Matteo', 'Lorenzo', 'Federico', 'Gianluca', 'Davide', 'Nicolò', 'Alessio', 'Tommaso', 'Riccardo'],
  NED: ['Daan', 'Sem', 'Jurriën', 'Bram', 'Thijs', 'Joep', 'Stijn', 'Ruud', 'Wout'],
  ARG: ['Facundo', 'Thiago', 'Lautaro', 'Gonzalo', 'Nahuel', 'Exequiel', 'Valentín', 'Agustín'],
  POR: ['Tiago', 'Rúben', 'Gonçalo', 'Duarte', 'Vitinho', 'Nuno', 'Rafa', 'Diogo'],
  NGA: ['Chidi', 'Emeka', 'Tunde', 'Obinna', 'Kelechi', 'Femi', 'Sadiq', 'Ademola'],
  JPN: ['Haruto', 'Ren', 'Sota', 'Kaito', 'Daichi', 'Yuto', 'Takumi', 'Riku'],
  KOR: ['Min-jun', 'Ji-ho', 'Seo-jun', 'Hyun-woo', 'Dong-hyun', 'Tae-yang'],
};

export const LAST_NAMES: Record<string, string[]> = {
  IDN: ['Pratama', 'Wicaksono', 'Saputra', 'Nugraha', 'Hidayat', 'Kurniawan', 'Setiadi', 'Mahendra', 'Permana', 'Halim'],
  BRA: ['Albuquerque', 'Mendonça', 'Ferraz', 'Bastos', 'Lacerda', 'Moreira', 'Toledo', 'Furtado', 'Siqueira'],
  ESP: ['Garrido', 'Olmedo', 'Valcárcel', 'Montoya', 'Iturbe', 'Salcedo', 'Arrieta', 'Bermejo', 'Cuesta'],
  ENG: ['Ashworth', 'Pembridge', 'Holloway', 'Whitcombe', 'Fairley', 'Thornton', 'Caldwell', 'Brackley', 'Ridley'],
  FRA: ['Delacroix', 'Moreau', 'Valois', 'Lemaire', 'Fontaine', 'Rocheteau', 'Gaudin', 'Perrin', 'Marchand'],
  GER: ['Brandauer', 'Kessler', 'Wendt', 'Hoffstetter', 'Lindemann', 'Vogt', 'Reinholz', 'Steinmann'],
  ITA: ['Benedetti', 'Carraro', 'Lombardo', 'Fiorentini', 'Marchetti', 'Saverino', 'Donatelli', 'Ruggeri'],
  NED: ['van Holten', 'de Bruijk', 'Verstrijden', 'Hoekstra', 'Brouwers', 'van Leeuwen', 'Dijkhuis'],
  ARG: ['Echeverría', 'Benítez', 'Quiroga', 'Sosa', 'Altamirano', 'Paredes', 'Larrosa', 'Funes'],
  POR: ['Carvalhal', 'Esteves', 'Macedo', 'Rebelo', 'Quaresmo', 'Antunes', 'Pinheiro'],
  NGA: ['Okafor', 'Adeyemi', 'Nwachukwu', 'Babatunde', 'Eze-Obi', 'Olumide', 'Ikenna'],
  JPN: ['Tanabe', 'Morikawa', 'Hasegawa', 'Ishida', 'Kurosawa', 'Fujimura', 'Nakahara'],
  KOR: ['Park', 'Seo', 'Jang', 'Moon', 'Baek', 'Yoon', 'Hwang'],
};

export const NATION_FLAGS: Record<string, string> = {
  IDN: '🇮🇩', BRA: '🇧🇷', ESP: '🇪🇸', ENG: '🏴', FRA: '🇫🇷', GER: '🇩🇪', ITA: '🇮🇹', NED: '🇳🇱',
  ARG: '🇦🇷', POR: '🇵🇹', NGA: '🇳🇬', JPN: '🇯🇵', KOR: '🇰🇷',
};

export const AI_CLUBS: { name: string; short: string; primary: string; secondary: string; rating: number }[] = [
  { name: 'Kingsbridge United', short: 'KBU', primary: '#c8102e', secondary: '#ffffff', rating: 80 },
  { name: 'Real Montevale', short: 'RMV', primary: '#f5f5f5', secondary: '#1e3a8a', rating: 79 },
  { name: 'Atlético Sanverra', short: 'ATS', primary: '#dc2626', secondary: '#1d4ed8', rating: 76 },
  { name: 'Dynamo Varenko', short: 'DYV', primary: '#1e40af', secondary: '#facc15', rating: 74 },
  { name: 'Sporting Lavera', short: 'SPL', primary: '#15803d', secondary: '#ffffff', rating: 73 },
  { name: 'Olympique Marveil', short: 'OLM', primary: '#38bdf8', secondary: '#0f172a', rating: 72 },
  { name: 'FC Nordhavn', short: 'NOR', primary: '#0f172a', secondary: '#f97316', rating: 70 },
  { name: 'Inter Calvara', short: 'INC', primary: '#111827', secondary: '#3b82f6', rating: 69 },
  { name: 'Rovers Ashford', short: 'ROA', primary: '#7c2d12', secondary: '#fbbf24', rating: 67 },
];

export const MENTALITY_LABELS = ['Sangat Defensif', 'Defensif', 'Seimbang', 'Ofensif', 'Sangat Ofensif'];
export const TEMPO_LABELS = ['Sangat Lambat', 'Lambat', 'Normal', 'Cepat', 'Sangat Cepat'];
export const PRESSING_LABELS = ['Sangat Rendah', 'Rendah', 'Sedang', 'Tinggi', 'Gegenpress'];

export const ATTR_LABELS: Record<string, string> = {
  pace: 'Kecepatan', shooting: 'Menyerang', passing: 'Passing', dribbling: 'Dribbling',
  defending: 'Bertahan', physical: 'Fisik', goalkeeping: 'Kiper',
};
export const ATTR_SHORT: Record<string, string> = {
  pace: 'PAC', shooting: 'SHO', passing: 'PAS', dribbling: 'DRI', defending: 'DEF', physical: 'PHY', goalkeeping: 'GK',
};
