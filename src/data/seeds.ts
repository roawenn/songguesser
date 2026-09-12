import type { CategoryId } from './categories'

/**
 * Kategori başına tohum sanatçı listesi.
 *
 * Yönetim panelindeki "sanatçı taraması" bu listeden çipler üretir; küratör
 * hafızadan şarkı adı yazmak yerine Apple TR kataloğunda GERÇEKTEN mevcut
 * olanlar arasından seçer. Hafızadan yazmanın çözümleme oranı %26'ydı; katalogtan
 * seçmenin %100.
 *
 * ⚠️ `scripts/suggest.ts` de buradan okur — liste tek yerde yaşasın.
 */
export const SEEDS: Partial<Record<CategoryId, string[]>> = {
  rap: [
    'Ceza', 'Sagopa Kajmer', 'Norm Ender', 'Ezhel', 'UZI', 'BLOK3', 'Sefo',
    'Gazapizm', 'Ben Fero', 'Khontkar', 'Motive', 'Lvbel C5', 'Anıl Piyancı',
    'Patron', 'Allame', 'Sansar Salvo', 'Ayben', 'Yener Çevik', 'Kamufle',
    'Da Poet', 'Killa Hakan', 'Fuat', 'Nefret', 'Contra', 'Aspova', 'Heijan',
    'Şanışer', 'Şehinşah', 'Tankurt Manas', 'Hidra', 'Canbay', 'Joker',
    'Ados', 'Muti', 'Kolera', 'Karaçalı', 'Server Uraz', 'Batuflex',
  ],
  pop: [
    'Tarkan', 'Sezen Aksu', 'Sertab Erener', 'Hadise', 'Mabel Matiz',
    'Kenan Doğulu', 'Mustafa Sandal', 'Nilüfer', 'Ajda Pekkan', 'Sıla',
    'Gülşen', 'Hande Yener', 'Teoman', 'Yalın', 'Emre Aydın', 'Simge',
    'Edis', 'Zeynep Bastık', 'manifest', 'Athena', 'Model', 'Serdar Ortaç',
    'Demet Akalın', 'Tuğba Yurt', 'Aleyna Tilki', 'Melek Mosso', 'Dedublüman',
  ],
  arabesk: [
    'Müslüm Gürses', 'Orhan Gencebay', 'Ferdi Tayfur', 'İbrahim Tatlıses',
    'Bergen', 'Ebru Gündeş', 'Mahsun Kırmızıgül', 'Azer Bülbül',
    'Cengiz Kurtoğlu', 'Gülden Karaböcek', 'Kibariye', 'Hakkı Bulut',
    'Selami Şahin', 'Küçük Emrah', 'Ceylan', 'Hakan Altun', 'Sibel Can',
  ],
  rock: [
    'Barış Manço', 'Cem Karaca', 'Erkin Koray', 'MFÖ', 'Duman',
    'mor ve ötesi', 'Şebnem Ferah', 'Teoman', 'maNga', 'Athena',
    'Yüksek Sadakat', 'Pentagram', 'Kurban', 'Adamlar', 'Gripin',
    'Kargo', 'Feridun Düzağaç', 'Hayko Cepkin', 'Zakkum', 'Replikas',
    'Moğollar', 'Yeni Türkü', 'Bulutsuzluk Özlemi',
  ],
  halk: [
    'Neşet Ertaş', 'Aşık Veysel', 'Selda Bağcan', 'Ruhi Su', 'Arif Sağ',
    'Musa Eroğlu', 'Belkıs Akkale', 'Kubat', 'Sabahat Akkiraz',
    'Muharrem Ertaş', 'Zara', 'Ahmet Kaya', 'Erdal Erzincan',
  ],
  sanat: [
    'Zeki Müren', 'Müzeyyen Senar', 'Bülent Ersoy', 'Muazzez Ersoy',
    'Emel Sayın', 'Behiye Aksoy', 'Hamiyet Yüceses', 'Necmettin Yıldırım',
  ],
  fantezi: [
    'Ümit Besen', 'Cengiz Kurtoğlu', 'Yıldız Tilbe', 'Mustafa Ceceli',
    'Hakan Altun', 'İsmail YK', 'Serdar Ortaç', 'Ebru Yaşar',
  ],
}

export function seedsFor(cat: CategoryId): string[] {
  return SEEDS[cat] ?? []
}
