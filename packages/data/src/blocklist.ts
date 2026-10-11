// Listas de bloqueo: se usan SOLO para EVITAR que el generador produzca nombres
// de clubes reales o de futbolistas famosos (regla 7 de CLAUDE.md).

/** Tokens genéricos que se ignoran al comparar nombres de club. */
const GENERIC_TOKENS = new Set(
  `fc cf afc ac as sc sv vfb vfl tsv fsv spvgg cd ud sd rc ss us usd ssc ogc rcd sad bk if ik gf ff fk nk sk hnk kaa krc rsc
   club de del la le les l d di of the calcio football futbol fútbol foot clube futebol deportivo deportiva sociedad
   association associazione unione sportiva sportive sportiva sport e v ev und`
    .split(/\s+/)
    .filter(Boolean),
);

/** Normaliza un nombre: minúsculas, sin acentos, sin puntuación, sin dígitos ni tokens genéricos. */
export function normalizeClubName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ß/g, "ss")
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t && !GENERIC_TOKENS.has(t))
    .join(" ");
}

export function normalizePersonName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .join(" ");
}

const lines = (s: string): string[] =>
  s
    .split("\n")
    .flatMap((l) => l.split("|"))
    .map((x) => x.trim())
    .filter(Boolean);

/** Clubes reales (principales divisiones de las naciones jugables y clubes conocidos del resto). */
const REAL_CLUBS = lines(`
Arsenal|Chelsea|Tottenham Hotspur|West Ham United|Crystal Palace|Fulham|Brentford|Queens Park Rangers|Millwall|Charlton Athletic|Leyton Orient|AFC Wimbledon|Barnet|Bromley|Sutton United|Dagenham & Redbridge|Wimbledon
Manchester United|Manchester City|Liverpool|Everton|Tranmere Rovers|Leeds United|Sheffield United|Sheffield Wednesday|Bristol City|Bristol Rovers
Newcastle United|Nottingham Forest|Notts County|Leicester City|Coventry City|Bradford City|Bradford Park Avenue|Southampton|Portsmouth|Plymouth Argyle
Derby County|Stoke City|Port Vale|Wolverhampton Wanderers|Sunderland|Middlesbrough|Hull City|Norwich City|Ipswich Town|Reading|Oxford United|Oxford City
Cambridge United|Cambridge City|Brighton & Hove Albion|Luton Town|Swindon Town|Preston North End|Blackburn Rovers|Burnley|Bolton Wanderers|Wigan Athletic
Blackpool|Huddersfield Town|Barnsley|Rotherham United|Doncaster Rovers|Peterborough United|Northampton Town|Milton Keynes Dons|MK Dons|Exeter City
AFC Bournemouth|Bournemouth|Watford|Gloucester City|Cheltenham Town|Forest Green Rovers|York City|Carlisle United|Lincoln City|Chester|Chester City
Bath City|Worcester City|Salisbury|Canterbury City|Colchester United|Shrewsbury Town|Stockport County|Aston Villa|Birmingham City|West Bromwich Albion
Walsall|Wycombe Wanderers|Stevenage|Crawley Town|Gillingham|Mansfield Town|Morecambe|Fleetwood Town|Accrington Stanley|Crewe Alexandra|Salford City
Harrogate Town|Grimsby Town|Scunthorpe United|Hartlepool United|Darlington|Burton Albion|Chesterfield|Barrow|Newport County|Southend United
Leyton Orient|Hereford United|Torquay United|Yeovil Town|Halifax Town|Oldham Athletic|Rochdale|Bury|Macclesfield Town|Wrexham|Cardiff City|Swansea City
Real Madrid|Atlético de Madrid|Atlético Madrid|Rayo Vallecano|Getafe|Leganés|Alcorcón|Fuenlabrada|Real Madrid Castilla|Barcelona|Espanyol|Sabadell|Terrassa|Cornellà|Badalona|L'Hospitalet
Valencia|Levante|Villarreal|Sevilla|Real Betis|Betis|Real Zaragoza|Zaragoza|Málaga|Real Murcia|Murcia|Mallorca|Real Mallorca|Las Palmas|Unión Deportiva Las Palmas|Athletic Club|Athletic Bilbao|Barakaldo|Arenas Club de Getxo|Arenas Getxo
Hércules|Alicante|Córdoba|Real Valladolid|Valladolid|Celta de Vigo|Celta|Sporting de Gijón|Sporting Gijón|Deportivo de La Coruña|Deportivo La Coruña|Deportivo Alavés|Alavés
Granada|Elche|Real Oviedo|Oviedo|Tenerife|CD Tenerife|Osasuna|Almería|Real Sociedad|Burgos|Racing de Santander|Racing Santander|Castellón|Albacete|Logroñés|UD Logroñés|SD Logroñés
Badajoz|Salamanca|Unionistas de Salamanca|Recreativo de Huelva|Recreativo Huelva|Marbella|Lleida|Gimnàstic de Tarragona|Gimnàstic Tarragona|Cultural Leonesa|Cádiz|Real Jaén|Ourense|Girona
Lugo|Cacereño|Racing de Ferrol|Racing Ferrol|Ponferradina|Algeciras|Eibar|Huesca|Cartagena|Mérida|Pontevedra|Zamora|Real Unión|Real Unión de Irún|Mirandés|Numancia|Tarazona|Xerez|Extremadura|Écija|Córdoba CF
AS Roma|Roma|Lazio|Milan|AC Milan|Inter|Internazionale|Inter Milan|Monza|Napoli|Torino|Juventus|Palermo|Genoa|Sampdoria|Bologna|Fiorentina|Bari|Catania|Venezia|Hellas Verona|Verona|Chievo|Chievo Verona
Messina|Padova|Triestina|Brescia|Parma|Taranto|Prato|Modena|Reggina|Reggiana|Perugia|Livorno|Ravenna|Cagliari|Foggia|Rimini|Salernitana|SPAL|Ferrara|Torres|Latina|Atalanta|Pescara|Vicenza|L.R. Vicenza|Udinese
Lecce|Cesena|Como|Cremonese|Empoli|Frosinone|Avellino|Benevento|Ascoli|Crotone|Spezia|Pisa|Lucchese|Sassuolo|Juve Stabia|Carrarese|Cittadella|Südtirol|Feralpisalò|Pro Vercelli|Pro Patria|Pro Sesto|Novara|Alessandria|Virtus Entella|Virtus Verona|Sudtirol|Mantova|Catanzaro|Cosenza|Pordenone|Lecco|Ternana|Sambenedettese|Siena|Arezzo|Pistoiese|Pontedera|Fano|Vis Pesaro
Hertha BSC|Hertha Berlin|Union Berlin|1. FC Union Berlin|BFC Dynamo|Tennis Borussia Berlin|Viktoria Berlin|Hamburger SV|FC St. Pauli|St. Pauli|Altona 93|Bayern München|Bayern Munich|TSV 1860 München|1860 München|SpVgg Unterhaching|Unterhaching
1. FC Köln|Köln|Fortuna Köln|Viktoria Köln|Eintracht Frankfurt|FSV Frankfurt|Kickers Offenbach|VfB Stuttgart|Stuttgarter Kickers|Fortuna Düsseldorf|RB Leipzig|Lokomotive Leipzig|Chemie Leipzig|Borussia Dortmund|Rot-Weiss Essen|Schwarz-Weiß Essen
Werder Bremen|Dynamo Dresden|Hannover 96|1. FC Nürnberg|Nürnberg|MSV Duisburg|VfL Bochum|Wuppertaler SV|Arminia Bielefeld|Bonner SC|Preußen Münster|Waldhof Mannheim|SV Waldhof Mannheim|Karlsruher SC|FC Augsburg|Augsburg
SV Wehen Wiesbaden|Wehen Wiesbaden|Schalke 04|FC Schalke 04|Borussia Mönchengladbach|Eintracht Braunschweig|Holstein Kiel|Alemannia Aachen|Chemnitzer FC|Hallescher FC|1. FC Magdeburg|SC Freiburg|Freiburg|KFC Uerdingen|Uerdingen
1. FSV Mainz 05|Mainz 05|Mainz|VfB Lübeck|Hansa Rostock|KSV Hessen Kassel|Rot-Weiß Oberhausen|1. FC Saarbrücken|SC Paderborn 07|Paderborn|SV Darmstadt 98|Darmstadt 98|Jahn Regensburg|Würzburger Kickers|VfL Wolfsburg|Wolfsburg|SSV Ulm 1846|Ulm
VfL Osnabrück|Osnabrück|SpVgg Greuther Fürth|Greuther Fürth|SV Sandhausen|Sandhausen|SV Elversberg|Elversberg|1. FC Heidenheim|Heidenheim|FC Carl Zeiss Jena|Carl Zeiss Jena|Rot-Weiß Erfurt|Energie Cottbus|FSV Zwickau|Bayer Leverkusen|TSG Hoffenheim|Hoffenheim|1. FC Kaiserslautern|Kaiserslautern|SV Meppen|Erzgebirge Aue|Aue|SC Verl|Verl|Viktoria Aschaffenburg|Eintracht Trier|Hessen Kassel|Kickers Würzburg|FC Ingolstadt|Ingolstadt
Paris Saint-Germain|Paris FC|Red Star|Red Star FC|US Créteil|Créteil|Racing Club de France|Versailles|FC Versailles|Olympique de Marseille|Marseille|Olympique Lyonnais|Lyon|Toulouse|OGC Nice|Nice|FC Nantes|Nantes|Montpellier|RC Strasbourg|Strasbourg
Girondins de Bordeaux|Bordeaux|LOSC Lille|Lille|Stade Rennais|Rennes|Stade de Reims|Reims|Sporting Toulon|Toulon|AS Saint-Étienne|Saint-Étienne|Le Havre|Grenoble Foot 38|Grenoble|Dijon|Angers|Nîmes Olympique|Nîmes|Clermont Foot|Clermont|Le Mans|Aix
Stade Brestois|Brest|Tours|Amiens|Limoges|Perpignan|FC Metz|Metz|Besançon|Orléans|US Orléans|FC Rouen|Rouen|FC Mulhouse|Mulhouse|Stade Malherbe Caen|Caen|AS Nancy-Lorraine|Nancy|Avignon|Poitiers|La Rochelle|Pau FC|Pau|FC Lorient|Lorient
SC Bastia|Bastia|AC Ajaccio|Ajaccio|Gazélec Ajaccio|AJ Auxerre|Auxerre|Troyes|ES Troyes AC|Valenciennes|En Avant Guingamp|Guingamp|Stade Lavallois|Laval|Chamois Niortais|Niort|FC Sochaux|Sochaux|RC Lens|Lens|FC Annecy|Annecy|Quevilly-Rouen|USL Dunkerque|Dunkerque|Bourg-Péronnas|AS Monaco|Monaco|Red Star Saint-Ouen|Stade Lavallois|Rodez|Châteauroux|Sedan|Martigues|Concarneau|Villefranche
Ajax|Ajax Amsterdam|PSV|PSV Eindhoven|Feyenoord|Feyenoord Rotterdam|Sparta Rotterdam|Excelsior|Excelsior Rotterdam|FC Utrecht|Utrecht|FC Groningen|Groningen|Vitesse|Vitesse Arnhem|AZ Alkmaar|FC Twente|Fortuna Sittard|Go Ahead Eagles
FC Porto|Porto|Sporting|Sporting Lisboa|Sporting Clube de Portugal|Benfica|Benfica Lisboa|Belenenses|SC Braga|Braga|Académica|Académica de Coimbra|Vitória de Setúbal|Setúbal|Marítimo|Nacional|Nacional Madeira|União da Madeira
Club Brugge|Brugge|Cercle Brugge|Anderlecht|RSC Anderlecht|Standard Liège|Standard|KAA Gent|Gent|Royal Antwerp|Antwerp|Sporting Charleroi|Charleroi|Union Saint-Gilloise
Dinamo Zagreb|Hajduk Split|Rijeka|HNK Rijeka|Osijek|NK Osijek|FC Basel|Basel|FC Zürich|Zürich|Grasshoppers|Grasshopper Club Zürich|Young Boys|BSC Young Boys|Servette|Servette Genève|Lausanne-Sport|Lausanne|FC Luzern|Luzern
FC København|København|Brøndby|Aarhus|AGF Aarhus|Odense|OB Odense|Aalborg|AaB Aalborg|Rapid Wien|Austria Wien|First Vienna|Sturm Graz|Grazer AK|LASK|LASK Linz|Red Bull Salzburg|FC Salzburg|Salzburg|Wacker Innsbruck|WSG Tirol
Crvena Zvezda|Red Star Belgrade|Partizan|Partizan Beograd|Vojvodina|Vojvodina Novi Sad|Radnički Niš|Radnički Kragujevac|Legia Warszawa|Polonia Warszawa|Wisła Kraków|Cracovia|Lech Poznań|Warta Poznań|Śląsk Wrocław|Lechia Gdańsk|Widzew Łódź|ŁKS Łódź
AIK|AIK Stockholm|Djurgården|Djurgårdens|Hammarby|IFK Göteborg|Göteborg|GAIS|Örgryte|Malmö FF|Malmö|IFK Norrköping|Norrköping|Rosenborg|Brann|Viking|Viking Stavanger|Bodø/Glimt|Bodø Glimt|Vålerenga|Lyn|Lillestrøm|Molde
Dynamo Kyiv|Dynamo Kiev|Shakhtar Donetsk|Karpaty Lviv|Rukh Lviv|Metalist Kharkiv|Chornomorets Odesa|Dnipro|Dnipro-1|Sparta Praha|Slavia Praha|Bohemians Praha|Viktoria Plzeň|Baník Ostrava|Sigma Olomouc|Zbrojovka Brno|Brno
Galatasaray|Fenerbahçe|Beşiktaş|İstanbul Başakşehir|Başakşehir|Trabzonspor|Bursaspor|Konyaspor|Göztepe|Altay|Karşıyaka|Ankaragücü|Gençlerbirliği
Celtic|Rangers|Partick Thistle|Queen's Park|Heart of Midlothian|Hearts|Hibernian|Aberdeen|Dundee|Dundee United|Inverness Caledonian Thistle|Inverness|Glasgow City
Newport County|Swansea|Shamrock Rovers|Bohemians|Bohemian|Shelbourne|St Patrick's Athletic|Cork City|Galway United|Limerick|Linfield|Glentoran|Crusaders|Cliftonville|Derry City
Ferencváros|Újpest|MTK Budapest|Honvéd|Budapest Honvéd|Debrecen|Debreceni VSC|Győri ETO|Győr|Szeged|Olympiacos|Panathinaikos|AEK Athens|AEK|PAOK|Aris|Aris Thessaloniki|OFI|Panachaiki
Steaua București|Steaua|FCSB|Dinamo București|Rapid București|CFR Cluj|Universitatea Cluj|Universitatea Craiova|Craiova|Politehnica Timișoara|Slovan Bratislava|Spartak Trnava|Žilina|MŠK Žilina|Košice
Olimpija Ljubljana|Maribor|NK Maribor|Celje|NK Celje|Željezničar|FK Sarajevo|Sarajevo|Zrinjski Mostar|Velež Mostar|Partizani|KF Tirana|Tirana|Vardar|Vardar Skopje|Budućnost|Budućnost Podgorica|Sutjeska Nikšić|Prishtina|Ballkani
Spartak Moskva|Spartak Moscow|CSKA Moskva|CSKA Moscow|Dinamo Moskva|Dynamo Moscow|Lokomotiv Moskva|Lokomotiv Moscow|Torpedo Moskva|Zenit|Zenit Sankt-Peterburg|Rubin Kazan|Rostov|FK Rostov|Krasnodar|FK Krasnodar
Levski Sofia|CSKA Sofia|Ludogorets|Botev Plovdiv|Lokomotiv Plovdiv|Cherno More|Maccabi Tel Aviv|Hapoel Tel Aviv|Maccabi Haifa|Hapoel Haifa|Hapoel Be'er Sheva|Beitar Jerusalem|BATE Borisov|Dinamo Minsk|Dinamo Brest|Dinamo Tbilisi|Torpedo Kutaisi|Dinamo Batumi
Pyunik|Ararat|Qarabağ|Neftçi|Neftçi Bakı|Astana|FC Astana|Kairat|Kairat Almaty|HJK|HJK Helsinki|Inter Turku|FC Inter Turku|KuPS|Ilves Tampere|Flora Tallinn|Levadia Tallinn|RFS Rīga|Riga FC|Žalgiris|Žalgiris Vilnius|Sheriff Tiraspol|Zimbru Chișinău
KÍ Klaksvík|HB Tórshavn|Valletta|Birkirkara|Hamrun Spartans|Floriana|FC Santa Coloma|Tre Penne|Vaduz|FC Vaduz|Lincoln Red Imps|Europa FC|F91 Dudelange|Dudelange|Progrès Niederkorn|APOEL|Omonia|Anorthosis|AEL Limassol|Apollon Limassol|Víkingur Reykjavík|Breiðablik|KR Reykjavík|Valur
Boca Juniors|River Plate|Racing Club|Racing|Independiente|San Lorenzo|Huracán|Vélez Sarsfield|Rosario Central|Newell's Old Boys|Estudiantes|Estudiantes de La Plata|Gimnasia La Plata|Gimnasia y Esgrima|Talleres|Talleres Córdoba|Belgrano|Instituto|Godoy Cruz|Argentinos Juniors|Lanús|Banfield|Arsenal de Sarandí
Flamengo|Fluminense|Vasco da Gama|Botafogo|Palmeiras|Corinthians|São Paulo|Santos|Grêmio|Internacional|Atlético Mineiro|Cruzeiro|América Mineiro|Bahia|Vitória|Sport Recife|Sport|Náutico|Santa Cruz|Athletico Paranaense|Coritiba|Paraná|Fortaleza|Ceará
Peñarol|Nacional|Defensor Sporting|Danubio|Millonarios|Santa Fe|Independiente Santa Fe|Atlético Nacional|Independiente Medellín|Deportivo Cali|América de Cali|Junior|Junior Barranquilla|Atlético Bucaramanga
LDU Quito|Liga de Quito|Independiente del Valle|El Nacional|Barcelona SC|Emelec|Deportivo Cuenca|Olimpia|Cerro Porteño|Libertad|Guaraní|Colo-Colo|Universidad de Chile|Universidad Católica|Santiago Wanderers|Everton de Viña del Mar|Huachipato
Alianza Lima|Universitario|Sporting Cristal|Melgar|Cienciano|Caracas|Deportivo Táchira|Bolívar|The Strongest|Oriente Petrolero|Blooming|Jorge Wilstermann
Club América|América|Chivas|Guadalajara|Atlas|Monterrey|Rayados|Tigres|Tigres UANL|Cruz Azul|Pumas|Pumas UNAM|Toluca|Deportivo Toluca|Puebla|Tijuana|Club Tijuana|León|Pachuca|Santos Laguna|Necaxa|Querétaro
LA Galaxy|Los Angeles FC|LAFC|New York Red Bulls|New York City|New York City FC|Seattle Sounders|Atlanta United|Philadelphia Union|Columbus Crew|Toronto FC|Vancouver Whitecaps|CF Montréal|Montréal Impact|Cavalry|Forge
Saprissa|Deportivo Saprissa|Alajuelense|Herediano|Tauro|Plaza Amador|Olimpia Tegucigalpa|Motagua|Marathón|Real España|Alianza|FAS|Comunicaciones|Municipal|Violette|Harbour View|Portmore United|Real Estelí
Wydad|Wydad Casablanca|Raja|Raja Casablanca|FAR Rabat|AS FAR|Fath Union Sport|FUS Rabat|Maghreb de Fès|MAS Fès|Al Ahly|Zamalek|Pyramids|Al Masry|Ismaily|Espérance de Tunis|Espérance Tunis|Club Africain|Étoile du Sahel|CS Sfaxien
MC Alger|USM Alger|JS Kabylie|CR Belouizdad|MC Oran|CS Constantine|ES Sétif|Kaizer Chiefs|Orlando Pirates|Mamelodi Sundowns|SuperSport United|Cape Town City|AmaZulu|TP Mazembe|AS Vita Club|DC Motema Pembe
ASEC Mimosas|ASEC Abidjan|Africa Sports|Hearts of Oak|Asante Kotoko|Enyimba|Kano Pillars|Rangers International|Shooting Stars|Coton Sport|Canon Yaoundé|Tonnerre Yaoundé|Union Douala|Djoliba|Stade Malien|Horoya|Hafia|Jaraaf|Génération Foot
Al Hilal|Al-Hilal|Al Nassr|Al-Nassr|Al Ittihad|Al-Ittihad|Al Ahli|Al-Ahli|Al Shabab|Al Ettifaq|Al Sadd|Al Duhail|Al Rayyan|Al Gharafa|Al Ain|Al Wahda|Al Jazira|Shabab Al Ahli|Al Wasl|Sharjah
Persepolis|Esteghlal|Sepahan|Tractor|Foolad|Al Zawraa|Al Quwa Al Jawiya|Al Faisaly|Al Wehdat|Pakhtakor|Nasaf|Bunyodkor|Navbahor|Al Seeb|Dhofar|Muharraq|Al Riffa
Urawa Red Diamonds|Urawa Reds|Kashima Antlers|Kawasaki Frontale|Yokohama F. Marinos|Yokohama FC|Gamba Osaka|Cerezo Osaka|Nagoya Grampus|FC Tokyo|Tokyo Verdy|Vissel Kobe|Sanfrecce Hiroshima|Jubilo Iwata|Shimizu S-Pulse
Jeonbuk Hyundai Motors|Jeonbuk|Ulsan Hyundai|Ulsan HD|Pohang Steelers|FC Seoul|Busan IPark|Incheon United|Suwon Samsung Bluewings|Daegu FC
Guangzhou Evergrande|Guangzhou|Shanghai Port|Shanghai SIPG|Shanghai Shenhua|Beijing Guoan|Shandong Taishan|Tianjin Teda|Chengdu Rongcheng|Wuhan Three Towns
Buriram United|Bangkok United|Muangthong United|Chiangmai United|Port FC|Hanoi FC|Hà Nội|Viettel|Hoàng Anh Gia Lai|Persija Jakarta|Persib Bandung|Persebaya Surabaya|Arema|Arema Malang
Sydney FC|Western Sydney Wanderers|Melbourne Victory|Melbourne City|Brisbane Roar|Perth Glory|Adelaide United|Auckland City|Wellington Phoenix|Auckland FC|Team Wellington|Ba FC|Lautoka FC|Hienghène Sport|AS Pirae|AS Tefana|Henderson Eels|Lae City
`);

const REAL_CLUB_SET = new Set(REAL_CLUBS.map(normalizeClubName).filter((x) => x.length > 0));

/** ¿Coincide (normalizado) con un club real? */
export function isRealClubName(name: string): boolean {
  const norm = normalizeClubName(name);
  return norm.length === 0 || REAL_CLUB_SET.has(norm);
}

/** Futbolistas y entrenadores famosos: ningún jugador generado puede llamarse así. */
const FAMOUS_PEOPLE = lines(`
Lionel Messi|Cristiano Ronaldo|Kylian Mbappé|Erling Haaland|Neymar|Mohamed Salah|Kevin De Bruyne|Harry Kane|Jude Bellingham|Vinícius Júnior|Luka Modrić|Robert Lewandowski
Karim Benzema|Sergio Ramos|Andrés Iniesta|Xavi Hernández|Gerard Piqué|Iker Casillas|David Villa|Fernando Torres|Raúl González|Carles Puyol|Sergio Busquets|Pedri González|Gavi
David Silva|Juan Mata|Cesc Fàbregas|Xabi Alonso|Santi Cazorla|Jesús Navas|Álvaro Morata|Dani Carvajal|Rodri Hernández|Lamine Yamal|Nico Williams|Dani Olmo|Mikel Merino|Unai Simón|Fabián Ruiz
Wayne Rooney|David Beckham|Steven Gerrard|Frank Lampard|John Terry|Rio Ferdinand|Paul Scholes|Gary Neville|Jamie Carragher|Michael Owen|Alan Shearer|Bobby Charlton|Bobby Moore|Gary Lineker
Raheem Sterling|Marcus Rashford|Phil Foden|Bukayo Saka|Declan Rice|Jack Grealish|Jordan Henderson|Jordan Pickford|John Stones|Kyle Walker|Harry Maguire|Mason Mount|Cole Palmer|Trent Alexander-Arnold
Francesco Totti|Alessandro Del Piero|Paolo Maldini|Andrea Pirlo|Gianluigi Buffon|Fabio Cannavaro|Roberto Baggio|Christian Vieri|Filippo Inzaghi|Alessandro Nesta|Daniele De Rossi|Gennaro Gattuso
Giorgio Chiellini|Leonardo Bonucci|Marco Verratti|Federico Chiesa|Lorenzo Insigne|Ciro Immobile|Nicolò Barella|Gianluigi Donnarumma|Sandro Tonali|Federico Dimarco|Alessandro Bastoni|Mario Balotelli
Thomas Müller|Manuel Neuer|Philipp Lahm|Bastian Schweinsteiger|Miroslav Klose|Michael Ballack|Toni Kroos|Mesut Özil|Marco Reus|Mats Hummels|Jérôme Boateng|İlkay Gündoğan|Joshua Kimmich|Leroy Sané|Kai Havertz|Jamal Musiala|Florian Wirtz|Antonio Rüdiger|Leon Goretzka|Serge Gnabry|Niclas Füllkrug
Zinedine Zidane|Thierry Henry|Michel Platini|Didier Deschamps|Patrick Vieira|Franck Ribéry|Antoine Griezmann|Paul Pogba|N'Golo Kanté|Hugo Lloris|Raphaël Varane|Olivier Giroud|Ousmane Dembélé|Aurélien Tchouaméni|Eduardo Camavinga|William Saliba|Mike Maignan|Jules Koundé|Theo Hernández|Marcus Thuram|Kingsley Coman|Randal Kolo Muani
Luís Figo|Rui Costa|Pepe|Bruno Fernandes|Bernardo Silva|João Félix|Rúben Dias|João Cancelo|Diogo Jota|Rafael Leão|Vitinha|João Neves|Nuno Mendes|Gonçalo Ramos
Arjen Robben|Robin van Persie|Wesley Sneijder|Clarence Seedorf|Edgar Davids|Dennis Bergkamp|Johan Cruyff|Marco van Basten|Ruud Gullit|Frank Rijkaard|Virgil van Dijk|Frenkie de Jong|Memphis Depay|Cody Gakpo|Matthijs de Ligt
Eden Hazard|Romelu Lukaku|Thibaut Courtois|Vincent Kompany|Jan Vertonghen|Toby Alderweireld|Axel Witsel|Youri Tielemans|Jérémy Doku|Leandro Trossard
Diego Maradona|Gabriel Batistuta|Juan Román Riquelme|Carlos Tévez|Sergio Agüero|Ángel Di María|Javier Mascherano|Javier Zanetti|Lautaro Martínez|Julián Álvarez|Enzo Fernández|Alexis Mac Allister|Emiliano Martínez|Rodrigo De Paul|Nicolás Otamendi|Paulo Dybala
Pelé|Ronaldo Nazário|Ronaldinho|Kaká|Rivaldo|Romário|Roberto Carlos|Cafu|Thiago Silva|Marcelo|Casemiro|Gabriel Jesus|Richarlison|Rodrygo|Raphinha|Alisson Becker|Ederson Moraes|Marquinhos|Endrick
Luis Suárez|Edinson Cavani|Diego Forlán|Federico Valverde|Darwin Núñez|Ronald Araújo|James Rodríguez|Radamel Falcao|Luis Díaz|Juan Cuadrado|Carlos Valderrama|Alexis Sánchez|Arturo Vidal
Didier Drogba|Samuel Eto'o|Yaya Touré|Kolo Touré|Sadio Mané|Riyad Mahrez|Achraf Hakimi|Hakim Ziyech|Victor Osimhen|Mohamed Elneny|Michael Essien|Jay-Jay Okocha|George Weah|Kalidou Koulibaly|Édouard Mendy|Ismaïla Sarr|Idrissa Gueye|Seydou Keita|Moussa Sissoko|Moussa Dembélé|Ibrahima Konaté|Wilfried Zaha|Franck Kessié|Sébastien Haller|Yassine Bounou|Sofyan Amrabat|Nicolas Jackson|Mohammed Kudus|Thomas Partey|Ademola Lookman|Wilfred Ndidi
Son Heung-min|Park Ji-sung|Kim Min-jae|Lee Kang-in|Hwang Hee-chan|Takefusa Kubo|Kaoru Mitoma|Wataru Endo|Takumi Minamino|Hidetoshi Nakata|Shinji Kagawa|Keisuke Honda|Mehdi Taremi|Sardar Azmoun|Ali Daei|Tim Cahill|Harry Kewell|Wu Lei
Zlatan Ibrahimović|Henrik Larsson|Peter Schmeichel|Kasper Schmeichel|Christian Eriksen|Martin Ødegaard|Alexander Isak|Viktor Gyökeres|Dejan Kulusevski|Gareth Bale|Ryan Giggs|Aaron Ramsey|Roy Keane|Robbie Keane|Andriy Shevchenko|Oleksandr Zinchenko|Mykhailo Mudryk
Pavel Nedvěd|Petr Čech|Tomáš Rosický|Patrik Schick|Marek Hamšík|Milan Škriniar|Dominik Szoboszlai|Ferenc Puskás|Gheorghe Hagi|Hristo Stoichkov|Dimitar Berbatov|Davor Šuker|Ivan Rakitić|Mateo Kovačić|Ivan Perišić|Joško Gvardiol|Dušan Vlahović|Sergej Milinković-Savić|Aleksandar Mitrović|Dušan Tadić|Edin Džeko|Miralem Pjanić|Jan Oblak|Benjamin Šeško|Granit Xhaka|Xherdan Shaqiri|Hakan Çalhanoğlu|Arda Güler|Kenan Yıldız|Burak Yılmaz|Khvicha Kvaratskhelia|Henrikh Mkhitaryan
Pep Guardiola|José Mourinho|Carlo Ancelotti|Jürgen Klopp|Alex Ferguson|Arsène Wenger|Diego Simeone|Mikel Arteta|Luis Enrique|Zinedine Zidane|Antonio Conte|Massimiliano Allegri|Thomas Tuchel|Julian Nagelsmann|Hansi Flick|Unai Emery|Mauricio Pochettino|Marcelo Bielsa|Xabi Alonso|Ange Postecoglou|Roberto De Zerbi
`);

const FAMOUS_SET = new Set(FAMOUS_PEOPLE.map(normalizePersonName));

export function isFamousPersonName(fullName: string): boolean {
  return FAMOUS_SET.has(normalizePersonName(fullName));
}
