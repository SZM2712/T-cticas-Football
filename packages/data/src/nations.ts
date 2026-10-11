// Naciones reales (decisión §9.1 de DISEÑO.md). Solo datos geográficos y culturales
// públicos; ningún club ni persona real.
//
// strength: nivel futbolístico relativo 0..1 (guía la calidad de sus jugadores).
// talent:   tamaño relativo de la cantera 0..1 (guía cuántos jugadores produce).
// cultures: mezcla de culturas de nombres/apariencia con su peso.
// cities:   ciudades para clubes "en sombra" de naciones no jugables.

export type ConfederationId = "EUR" | "SAM" | "NCA" | "AFR" | "ASI" | "OCE";
export type Climate = "oceanic" | "mediterranean" | "continental" | "nordic" | "tropical" | "arid" | "highland";

export interface NationData {
  /** ISO 3166-1 alfa-2, o subdivisión ISO para las naciones británicas (GB-ENG...). */
  code: string;
  /** Código de 3 letras para marcadores y tablas. */
  short: string;
  confed: ConfederationId;
  languages: string[];
  cultures: Record<string, number>;
  strength: number;
  talent: number;
  climate: Climate;
  cities: string[];
}

const n = (
  code: string,
  short: string,
  confed: ConfederationId,
  languages: string[],
  cultures: Record<string, number>,
  strength: number,
  talent: number,
  climate: Climate,
  cities: string[],
): NationData => ({ code, short, confed, languages, cultures, strength, talent, climate, cities });

export const NATIONS: readonly NationData[] = [
  // ── Europa ───────────────────────────────────────────────────────────────
  n("GB-ENG", "ENG", "EUR", ["en"], { english: 0.78, westAfricaEn: 0.1, caribbean: 0.07, irish: 0.05 }, 0.92, 1, "oceanic", []),
  n("ES", "ESP", "EUR", ["es"], { spanish: 0.88, westAfricaFr: 0.04, latam: 0.05, arabic: 0.03 }, 0.95, 0.95, "mediterranean", []),
  n("IT", "ITA", "EUR", ["it"], { italian: 0.93, westAfricaFr: 0.03, latam: 0.04 }, 0.86, 0.9, "mediterranean", []),
  n("DE", "GER", "EUR", ["de"], { german: 0.76, turkish: 0.1, southSlavic: 0.04, polish: 0.04, westAfricaFr: 0.06 }, 0.88, 0.95, "continental", []),
  n("FR", "FRA", "EUR", ["fr"], { french: 0.58, westAfricaFr: 0.24, arabic: 0.12, caribbean: 0.06 }, 0.95, 1, "oceanic", []),
  n("PT", "POR", "EUR", ["pt"], { portuguese: 0.88, lusophoneAfrica: 0.12 }, 0.9, 0.7, "mediterranean", ["Lisboa", "Porto", "Braga", "Coimbra", "Setúbal", "Funchal"]),
  n("NL", "NED", "EUR", ["nl"], { dutch: 0.8, caribbean: 0.12, arabic: 0.08 }, 0.86, 0.7, "oceanic", ["Amsterdam", "Rotterdam", "Eindhoven", "Utrecht", "Groningen", "Arnhem"]),
  n("BE", "BEL", "EUR", ["nl", "fr"], { dutch: 0.45, french: 0.3, westAfricaFr: 0.15, arabic: 0.1 }, 0.8, 0.6, "oceanic", ["Bruxelles", "Antwerpen", "Gent", "Brugge", "Liège", "Charleroi"]),
  n("HR", "CRO", "EUR", ["hr"], { southSlavic: 1 }, 0.8, 0.45, "mediterranean", ["Zagreb", "Split", "Rijeka", "Osijek"]),
  n("CH", "SUI", "EUR", ["de", "fr", "it"], { german: 0.5, french: 0.2, italian: 0.08, southSlavic: 0.1, albanian: 0.07, westAfricaFr: 0.05 }, 0.72, 0.45, "continental", ["Zürich", "Basel", "Bern", "Genève", "Lausanne", "Luzern"]),
  n("DK", "DEN", "EUR", ["da"], { nordic: 0.92, westAfricaEn: 0.04, arabic: 0.04 }, 0.74, 0.45, "nordic", ["København", "Aarhus", "Odense", "Aalborg"]),
  n("AT", "AUT", "EUR", ["de"], { german: 0.8, southSlavic: 0.1, turkish: 0.1 }, 0.72, 0.45, "continental", ["Wien", "Graz", "Linz", "Salzburg", "Innsbruck"]),
  n("RS", "SRB", "EUR", ["sr"], { southSlavic: 1 }, 0.66, 0.5, "continental", ["Beograd", "Novi Sad", "Niš", "Kragujevac"]),
  n("PL", "POL", "EUR", ["pl"], { polish: 1 }, 0.66, 0.6, "continental", ["Warszawa", "Kraków", "Poznań", "Wrocław", "Gdańsk", "Łódź"]),
  n("SE", "SWE", "EUR", ["sv"], { nordic: 0.82, arabic: 0.06, southSlavic: 0.06, eastAfrica: 0.06 }, 0.66, 0.5, "nordic", ["Stockholm", "Göteborg", "Malmö", "Norrköping"]),
  n("NO", "NOR", "EUR", ["no"], { nordic: 0.9, westAfricaEn: 0.05, eastAfrica: 0.05 }, 0.7, 0.4, "nordic", ["Oslo", "Bergen", "Trondheim", "Stavanger", "Bodø"]),
  n("UA", "UKR", "EUR", ["uk"], { eastSlavic: 1 }, 0.68, 0.6, "continental", ["Kyiv", "Lviv", "Kharkiv", "Odesa", "Dnipro"]),
  n("CZ", "CZE", "EUR", ["cs"], { czechSlovak: 1 }, 0.64, 0.45, "continental", ["Praha", "Brno", "Plzeň", "Ostrava", "Olomouc"]),
  n("TR", "TUR", "EUR", ["tr"], { turkish: 1 }, 0.72, 0.75, "mediterranean", ["İstanbul", "Ankara", "İzmir", "Trabzon", "Bursa", "Konya"]),
  n("GB-SCT", "SCO", "EUR", ["en"], { english: 0.55, irish: 0.45 }, 0.6, 0.35, "oceanic", ["Glasgow", "Edinburgh", "Aberdeen", "Dundee", "Inverness"]),
  n("GB-WLS", "WAL", "EUR", ["en", "cy"], { welsh: 0.7, english: 0.3 }, 0.56, 0.25, "oceanic", ["Cardiff", "Swansea", "Wrexham", "Newport"]),
  n("IE", "IRL", "EUR", ["en", "ga"], { irish: 0.9, westAfricaEn: 0.1 }, 0.54, 0.3, "oceanic", ["Dublin", "Cork", "Galway", "Limerick"]),
  n("GB-NIR", "NIR", "EUR", ["en"], { irish: 0.7, english: 0.3 }, 0.45, 0.15, "oceanic", ["Belfast", "Derry", "Lisburn"]),
  n("HU", "HUN", "EUR", ["hu"], { hungarian: 1 }, 0.62, 0.4, "continental", ["Budapest", "Debrecen", "Győr", "Szeged"]),
  n("GR", "GRE", "EUR", ["el"], { greek: 1 }, 0.58, 0.45, "mediterranean", ["Athína", "Thessaloníki", "Pátra", "Irákleio"]),
  n("RO", "ROU", "EUR", ["ro"], { romanian: 1 }, 0.6, 0.5, "continental", ["București", "Cluj-Napoca", "Craiova", "Timișoara"]),
  n("SK", "SVK", "EUR", ["sk"], { czechSlovak: 1 }, 0.58, 0.3, "continental", ["Bratislava", "Košice", "Žilina", "Trnava"]),
  n("SI", "SVN", "EUR", ["sl"], { southSlavic: 1 }, 0.55, 0.2, "continental", ["Ljubljana", "Maribor", "Celje"]),
  n("BA", "BIH", "EUR", ["bs"], { southSlavic: 1 }, 0.52, 0.3, "continental", ["Sarajevo", "Mostar", "Tuzla", "Zenica"]),
  n("AL", "ALB", "EUR", ["sq"], { albanian: 1 }, 0.52, 0.25, "mediterranean", ["Tiranë", "Durrës", "Shkodër"]),
  n("MK", "MKD", "EUR", ["mk"], { southSlavic: 0.75, albanian: 0.25 }, 0.45, 0.15, "continental", ["Skopje", "Bitola", "Tetovo"]),
  n("ME", "MNE", "EUR", ["sr"], { southSlavic: 1 }, 0.45, 0.1, "mediterranean", ["Podgorica", "Nikšić"]),
  n("XK", "KOS", "EUR", ["sq"], { albanian: 1 }, 0.45, 0.15, "continental", ["Prishtinë", "Prizren"]),
  n("IS", "ISL", "EUR", ["is"], { nordic: 1 }, 0.5, 0.08, "nordic", ["Reykjavík", "Akureyri"]),
  n("FI", "FIN", "EUR", ["fi"], { finnish: 0.9, eastAfrica: 0.05, westAfricaEn: 0.05 }, 0.48, 0.25, "nordic", ["Helsinki", "Turku", "Tampere"]),
  n("GE", "GEO", "EUR", ["ka"], { caucasian: 1 }, 0.55, 0.2, "continental", ["Tbilisi", "Batumi", "Kutaisi"]),
  n("RU", "RUS", "EUR", ["ru"], { eastSlavic: 0.9, caucasian: 0.1 }, 0.66, 0.7, "continental", ["Moskva", "Sankt-Peterburg", "Kazan", "Rostov-na-Donu", "Krasnodar"]),
  n("BG", "BUL", "EUR", ["bg"], { southSlavic: 1 }, 0.45, 0.25, "continental", ["Sofia", "Plovdiv", "Varna"]),
  n("IL", "ISR", "EUR", ["he"], { hebrew: 0.8, arabic: 0.2 }, 0.5, 0.25, "mediterranean", ["Tel Aviv", "Haifa", "Be'er Sheva", "Jerusalem"]),
  n("BY", "BLR", "EUR", ["be", "ru"], { eastSlavic: 1 }, 0.4, 0.25, "continental", ["Minsk", "Brest", "Gomel"]),
  n("AM", "ARM", "EUR", ["hy"], { caucasian: 1 }, 0.38, 0.1, "continental", ["Yerevan", "Gyumri"]),
  n("AZ", "AZE", "EUR", ["az"], { caucasian: 0.6, turkish: 0.4 }, 0.35, 0.15, "continental", ["Bakı", "Gəncə"]),
  n("KZ", "KAZ", "EUR", ["kk", "ru"], { centralAsian: 0.7, eastSlavic: 0.3 }, 0.36, 0.2, "continental", ["Astana", "Almaty", "Shymkent"]),
  n("LU", "LUX", "EUR", ["lb", "fr", "de"], { french: 0.4, german: 0.3, portuguese: 0.3 }, 0.32, 0.05, "oceanic", ["Luxembourg", "Esch-sur-Alzette"]),
  n("CY", "CYP", "EUR", ["el"], { greek: 1 }, 0.3, 0.06, "mediterranean", ["Lefkosía", "Lemesós", "Lárnaka"]),
  n("EE", "EST", "EUR", ["et"], { finnish: 0.6, eastSlavic: 0.4 }, 0.28, 0.05, "nordic", ["Tallinn", "Tartu"]),
  n("LV", "LVA", "EUR", ["lv"], { baltic: 0.7, eastSlavic: 0.3 }, 0.26, 0.06, "nordic", ["Rīga", "Liepāja"]),
  n("LT", "LTU", "EUR", ["lt"], { baltic: 1 }, 0.28, 0.08, "nordic", ["Vilnius", "Kaunas"]),
  n("MD", "MDA", "EUR", ["ro"], { romanian: 0.8, eastSlavic: 0.2 }, 0.25, 0.08, "continental", ["Chișinău", "Tiraspol"]),
  n("FO", "FRO", "EUR", ["fo"], { nordic: 1 }, 0.22, 0.02, "nordic", ["Tórshavn", "Klaksvík"]),
  n("MT", "MLT", "EUR", ["mt", "en"], { maltese: 1 }, 0.2, 0.03, "mediterranean", ["Valletta", "Birkirkara"]),
  n("AD", "AND", "EUR", ["ca"], { spanish: 0.6, portuguese: 0.2, french: 0.2 }, 0.1, 0.01, "highland", ["Andorra la Vella"]),
  n("SM", "SMR", "EUR", ["it"], { italian: 1 }, 0.06, 0.01, "mediterranean", ["Serravalle"]),
  n("LI", "LIE", "EUR", ["de"], { german: 1 }, 0.12, 0.01, "continental", ["Vaduz"]),
  n("GI", "GIB", "EUR", ["en"], { english: 0.6, spanish: 0.4 }, 0.08, 0.01, "mediterranean", ["Gibraltar"]),
  // ── Sudamérica ───────────────────────────────────────────────────────────
  n("AR", "ARG", "SAM", ["es"], { latam: 0.6, italian: 0.3, spanish: 0.1 }, 0.95, 0.95, "oceanic", ["Buenos Aires", "Rosario", "Córdoba", "La Plata", "Mendoza", "Avellaneda"]),
  n("BR", "BRA", "SAM", ["pt"], { brazilian: 1 }, 0.93, 1, "tropical", ["São Paulo", "Rio de Janeiro", "Belo Horizonte", "Porto Alegre", "Salvador", "Recife", "Curitiba", "Fortaleza"]),
  n("UY", "URU", "SAM", ["es"], { latam: 0.7, italian: 0.2, spanish: 0.1 }, 0.82, 0.4, "oceanic", ["Montevideo", "Salto", "Paysandú"]),
  n("CO", "COL", "SAM", ["es"], { latam: 1 }, 0.82, 0.75, "tropical", ["Bogotá", "Medellín", "Cali", "Barranquilla", "Bucaramanga"]),
  n("EC", "ECU", "SAM", ["es"], { latam: 1 }, 0.74, 0.5, "highland", ["Quito", "Guayaquil", "Cuenca"]),
  n("PY", "PAR", "SAM", ["es", "gn"], { latam: 1 }, 0.66, 0.4, "tropical", ["Asunción", "Ciudad del Este", "Encarnación"]),
  n("CL", "CHI", "SAM", ["es"], { latam: 1 }, 0.65, 0.5, "mediterranean", ["Santiago", "Valparaíso", "Concepción", "Temuco"]),
  n("PE", "PER", "SAM", ["es"], { latam: 1 }, 0.6, 0.45, "arid", ["Lima", "Arequipa", "Trujillo", "Cusco"]),
  n("VE", "VEN", "SAM", ["es"], { latam: 1 }, 0.6, 0.45, "tropical", ["Caracas", "Maracaibo", "Valencia", "Barquisimeto"]),
  n("BO", "BOL", "SAM", ["es"], { latam: 1 }, 0.45, 0.3, "highland", ["La Paz", "Santa Cruz de la Sierra", "Cochabamba"]),
  // ── Norte y Centroamérica, Caribe ─────────────────────────────────────────
  n("MX", "MEX", "NCA", ["es"], { latam: 1 }, 0.74, 0.85, "arid", ["Ciudad de México", "Guadalajara", "Monterrey", "Puebla", "Toluca", "Tijuana"]),
  n("US", "USA", "NCA", ["en"], { english: 0.55, latam: 0.25, westAfricaEn: 0.1, caribbean: 0.1 }, 0.75, 0.85, "continental", ["Los Angeles", "New York", "Seattle", "Atlanta", "Philadelphia", "Columbus"]),
  n("CA", "CAN", "NCA", ["en", "fr"], { english: 0.5, french: 0.15, caribbean: 0.15, westAfricaEn: 0.1, latam: 0.1 }, 0.7, 0.5, "continental", ["Toronto", "Vancouver", "Montréal", "Calgary"]),
  n("CR", "CRC", "NCA", ["es"], { latam: 1 }, 0.55, 0.25, "tropical", ["San José", "Alajuela", "Heredia"]),
  n("PA", "PAN", "NCA", ["es"], { latam: 0.8, caribbean: 0.2 }, 0.58, 0.2, "tropical", ["Ciudad de Panamá", "Colón"]),
  n("JM", "JAM", "NCA", ["en"], { caribbean: 1 }, 0.52, 0.2, "tropical", ["Kingston", "Montego Bay"]),
  n("HN", "HON", "NCA", ["es"], { latam: 1 }, 0.48, 0.25, "tropical", ["Tegucigalpa", "San Pedro Sula"]),
  n("SV", "SLV", "NCA", ["es"], { latam: 1 }, 0.4, 0.2, "tropical", ["San Salvador", "Santa Ana"]),
  n("GT", "GUA", "NCA", ["es"], { latam: 1 }, 0.42, 0.25, "tropical", ["Ciudad de Guatemala", "Quetzaltenango"]),
  n("HT", "HAI", "NCA", ["fr", "ht"], { caribbean: 1 }, 0.4, 0.2, "tropical", ["Port-au-Prince", "Cap-Haïtien"]),
  n("TT", "TRI", "NCA", ["en"], { caribbean: 1 }, 0.38, 0.1, "tropical", ["Port of Spain", "San Fernando"]),
  n("CW", "CUW", "NCA", ["nl", "pap"], { caribbean: 0.6, dutch: 0.4 }, 0.4, 0.04, "tropical", ["Willemstad"]),
  n("NI", "NCA", "NCA", ["es"], { latam: 1 }, 0.3, 0.15, "tropical", ["Managua", "León"]),
  n("SR", "SUR", "NCA", ["nl"], { caribbean: 0.7, dutch: 0.3 }, 0.35, 0.05, "tropical", ["Paramaribo"]),
  // ── África ───────────────────────────────────────────────────────────────
  n("MA", "MAR", "AFR", ["ar", "fr"], { arabic: 1 }, 0.84, 0.6, "mediterranean", ["Casablanca", "Rabat", "Fès", "Marrakech", "Tanger"]),
  n("SN", "SEN", "AFR", ["fr", "wo"], { westAfricaFr: 1 }, 0.8, 0.55, "tropical", ["Dakar", "Thiès", "Saint-Louis"]),
  n("NG", "NGA", "AFR", ["en"], { westAfricaEn: 1 }, 0.72, 0.9, "tropical", ["Lagos", "Abuja", "Kano", "Enugu", "Port Harcourt"]),
  n("EG", "EGY", "AFR", ["ar"], { arabic: 1 }, 0.7, 0.75, "arid", ["Al-Qāhira", "Al-Iskandariyya", "Port Said", "Ismailia"]),
  n("CI", "CIV", "AFR", ["fr"], { westAfricaFr: 1 }, 0.74, 0.6, "tropical", ["Abidjan", "Bouaké", "San-Pédro"]),
  n("DZ", "ALG", "AFR", ["ar", "fr"], { arabic: 1 }, 0.72, 0.6, "arid", ["Alger", "Oran", "Constantine", "Sétif"]),
  n("CM", "CMR", "AFR", ["fr", "en"], { westAfricaFr: 1 }, 0.7, 0.6, "tropical", ["Yaoundé", "Douala", "Garoua"]),
  n("TN", "TUN", "AFR", ["ar", "fr"], { arabic: 1 }, 0.65, 0.4, "mediterranean", ["Tunis", "Sfax", "Sousse"]),
  n("GH", "GHA", "AFR", ["en"], { westAfricaEn: 1 }, 0.66, 0.65, "tropical", ["Accra", "Kumasi", "Tamale"]),
  n("ML", "MLI", "AFR", ["fr"], { westAfricaFr: 1 }, 0.66, 0.5, "arid", ["Bamako", "Sikasso", "Ségou"]),
  n("ZA", "RSA", "AFR", ["en", "zu", "af"], { southernAfrica: 1 }, 0.6, 0.55, "mediterranean", ["Johannesburg", "Cape Town", "Durban", "Pretoria"]),
  n("BF", "BFA", "AFR", ["fr"], { westAfricaFr: 1 }, 0.58, 0.35, "arid", ["Ouagadougou", "Bobo-Dioulasso"]),
  n("CD", "COD", "AFR", ["fr"], { westAfricaFr: 1 }, 0.62, 0.6, "tropical", ["Kinshasa", "Lubumbashi", "Mbuji-Mayi"]),
  n("GN", "GUI", "AFR", ["fr"], { westAfricaFr: 1 }, 0.55, 0.35, "tropical", ["Conakry", "Kankan"]),
  n("CV", "CPV", "AFR", ["pt"], { lusophoneAfrica: 1 }, 0.55, 0.1, "arid", ["Praia", "Mindelo"]),
  n("GA", "GAB", "AFR", ["fr"], { westAfricaFr: 1 }, 0.5, 0.12, "tropical", ["Libreville", "Port-Gentil"]),
  n("ZM", "ZAM", "AFR", ["en"], { southernAfrica: 1 }, 0.48, 0.3, "tropical", ["Lusaka", "Ndola", "Kitwe"]),
  n("AO", "ANG", "AFR", ["pt"], { lusophoneAfrica: 1 }, 0.48, 0.35, "tropical", ["Luanda", "Huambo", "Benguela"]),
  n("UG", "UGA", "AFR", ["en"], { eastAfrica: 1 }, 0.45, 0.35, "tropical", ["Kampala", "Jinja"]),
  n("BJ", "BEN", "AFR", ["fr"], { westAfricaFr: 1 }, 0.45, 0.2, "tropical", ["Cotonou", "Porto-Novo"]),
  n("KE", "KEN", "AFR", ["en", "sw"], { eastAfrica: 1 }, 0.4, 0.35, "highland", ["Nairobi", "Mombasa", "Kisumu"]),
  n("TZ", "TAN", "AFR", ["sw", "en"], { eastAfrica: 1 }, 0.38, 0.3, "tropical", ["Dar es Salaam", "Dodoma", "Arusha"]),
  // ── Asia ─────────────────────────────────────────────────────────────────
  n("JP", "JPN", "ASI", ["ja"], { japanese: 1 }, 0.82, 0.8, "oceanic", ["Tōkyō", "Ōsaka", "Yokohama", "Nagoya", "Kashima", "Urawa", "Kawasaki"]),
  n("KR", "KOR", "ASI", ["ko"], { korean: 1 }, 0.78, 0.65, "continental", ["Seoul", "Busan", "Ulsan", "Jeonju", "Pohang", "Incheon"]),
  n("IR", "IRN", "ASI", ["fa"], { persian: 1 }, 0.74, 0.6, "arid", ["Tehrān", "Esfahān", "Tabrīz", "Mashhad"]),
  n("AU", "AUS", "ASI", ["en"], { english: 0.7, southSlavic: 0.1, italian: 0.1, greek: 0.1 }, 0.72, 0.55, "mediterranean", ["Sydney", "Melbourne", "Brisbane", "Perth", "Adelaide"]),
  n("SA", "KSA", "ASI", ["ar"], { arabic: 1 }, 0.65, 0.5, "arid", ["Ar-Riyāḍ", "Jiddah", "Ad-Dammām", "Makkah"]),
  n("QA", "QAT", "ASI", ["ar"], { arabic: 1 }, 0.6, 0.15, "arid", ["Ad-Dawḥa", "Al-Wakrah"]),
  n("IQ", "IRQ", "ASI", ["ar", "ku"], { arabic: 1 }, 0.58, 0.4, "arid", ["Baghdād", "Al-Baṣrah", "Arbīl"]),
  n("AE", "UAE", "ASI", ["ar"], { arabic: 1 }, 0.58, 0.2, "arid", ["Abū Ẓabī", "Dubayy", "Al-'Ayn", "Ash-Shāriqah"]),
  n("UZ", "UZB", "ASI", ["uz"], { centralAsian: 1 }, 0.64, 0.45, "arid", ["Toshkent", "Samarqand", "Namangan"]),
  n("JO", "JOR", "ASI", ["ar"], { arabic: 1 }, 0.56, 0.2, "arid", ["'Ammān", "Az-Zarqā'", "Irbid"]),
  n("OM", "OMA", "ASI", ["ar"], { arabic: 1 }, 0.5, 0.15, "arid", ["Masqaṭ", "Ṣalālah"]),
  n("CN", "CHN", "ASI", ["zh"], { chinese: 1 }, 0.5, 0.75, "continental", ["Běijīng", "Shànghǎi", "Guǎngzhōu", "Tiānjīn", "Chéngdū", "Wǔhàn"]),
  n("BH", "BHR", "ASI", ["ar"], { arabic: 1 }, 0.45, 0.08, "arid", ["Al-Manāmah", "Al-Muḥarraq"]),
  n("SY", "SYR", "ASI", ["ar"], { arabic: 1 }, 0.45, 0.3, "arid", ["Dimashq", "Ḥalab", "Al-Lādhiqiyyah"]),
  n("PS", "PLE", "ASI", ["ar"], { arabic: 1 }, 0.44, 0.15, "mediterranean", ["Ramallah", "Hebron", "Gaza"]),
  n("TH", "THA", "ASI", ["th"], { thai: 1 }, 0.45, 0.45, "tropical", ["Krung Thep", "Buriram", "Chiang Mai", "Chon Buri"]),
  n("VN", "VIE", "ASI", ["vi"], { vietnamese: 1 }, 0.42, 0.45, "tropical", ["Hà Nội", "Thành phố Hồ Chí Minh", "Hải Phòng"]),
  n("ID", "IDN", "ASI", ["id"], { indonesian: 0.85, dutch: 0.15 }, 0.44, 0.55, "tropical", ["Jakarta", "Surabaya", "Bandung", "Malang"]),
  // ── Oceanía ──────────────────────────────────────────────────────────────
  n("NZ", "NZL", "OCE", ["en", "mi"], { english: 0.75, pacific: 0.25 }, 0.5, 0.25, "oceanic", ["Auckland", "Wellington", "Christchurch"]),
  n("FJ", "FIJ", "OCE", ["en", "fj"], { pacific: 1 }, 0.25, 0.05, "tropical", ["Suva", "Lautoka"]),
  n("NC", "NCL", "OCE", ["fr"], { pacific: 0.6, french: 0.4 }, 0.22, 0.03, "tropical", ["Nouméa"]),
  n("PF", "TAH", "OCE", ["fr"], { pacific: 1 }, 0.2, 0.03, "tropical", ["Papeete"]),
  n("SB", "SOL", "OCE", ["en"], { pacific: 1 }, 0.25, 0.04, "tropical", ["Honiara"]),
  n("PG", "PNG", "OCE", ["en"], { pacific: 1 }, 0.2, 0.05, "tropical", ["Port Moresby", "Lae"]),
];

/** Naciones con ligas jugables en la v1 (§8.1). */
export const PLAYABLE_NATIONS = ["GB-ENG", "ES", "IT", "DE", "FR"] as const;
export type PlayableNation = (typeof PLAYABLE_NATIONS)[number];

export function nationByCode(code: string): NationData {
  const nation = NATIONS.find((x) => x.code === code);
  if (!nation) throw new Error(`Nación desconocida: ${code}`);
  return nation;
}
