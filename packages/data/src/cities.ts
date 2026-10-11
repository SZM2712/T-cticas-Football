// Ciudades reales de las naciones jugables, con población aproximada (miles) y
// distritos para ciudades grandes que pueden albergar varios clubes.

export interface CityData {
  name: string;
  pop: number;
  /** Barrios o municipios del área para nombrar clubes adicionales de la misma ciudad. */
  districts?: string[];
}

const c = (name: string, pop: number, districts?: string[]): CityData =>
  districts ? { name, pop, districts } : { name, pop };

export const PLAYABLE_CITIES: Record<string, CityData[]> = {
  "GB-ENG": [
    c("London", 9000, ["Hackney", "Lambeth", "Camden", "Greenwich", "Ealing", "Croydon", "Barnet", "Bromley", "Brixton", "Islington"]),
    c("Birmingham", 1150, ["Edgbaston", "Aston", "Handsworth"]),
    c("Manchester", 550, ["Salford", "Didsbury", "Moss Side"]),
    c("Liverpool", 500, ["Anfield", "Toxteth", "Bootle"]),
    c("Leeds", 800, ["Headingley"]),
    c("Sheffield", 560, ["Hillsborough"]),
    c("Bristol", 470, ["Bedminster"]),
    c("Newcastle", 300), c("Nottingham", 330), c("Leicester", 370), c("Coventry", 345), c("Bradford", 360),
    c("Southampton", 250), c("Portsmouth", 210), c("Plymouth", 265), c("Derby", 260), c("Stoke", 255),
    c("Wolverhampton", 265), c("Sunderland", 175), c("Middlesbrough", 145), c("Hull", 260), c("Norwich", 145),
    c("Ipswich", 140), c("Reading", 175), c("Oxford", 160), c("Cambridge", 145), c("Brighton", 290),
    c("Luton", 225), c("Swindon", 185), c("Preston", 145), c("Blackburn", 120), c("Burnley", 75),
    c("Bolton", 195), c("Wigan", 105), c("Blackpool", 140), c("Huddersfield", 160), c("Barnsley", 95),
    c("Rotherham", 110), c("Doncaster", 110), c("Peterborough", 215), c("Northampton", 230), c("Milton Keynes", 250),
    c("Exeter", 130), c("Bournemouth", 200), c("Watford", 100), c("Gloucester", 130), c("York", 205),
    c("Carlisle", 75), c("Lincoln", 105), c("Chester", 90), c("Bath", 95), c("Worcester", 105),
    c("Salisbury", 42), c("Canterbury", 55), c("Colchester", 130), c("Shrewsbury", 75), c("Stockport", 140),
  ],
  ES: [
    c("Madrid", 3300, ["Vallecas", "Carabanchel", "Chamartín", "Tetuán", "Leganés", "Getafe", "Alcorcón", "Fuenlabrada", "Móstoles"]),
    c("Barcelona", 1650, ["Sants", "Gràcia", "Badalona", "L'Hospitalet", "Sabadell", "Terrassa", "Cornellà"]),
    c("Valencia", 800, ["Benimaclet", "Torrent"]),
    c("Sevilla", 690, ["Triana", "Nervión", "Dos Hermanas"]),
    c("Zaragoza", 675), c("Málaga", 580), c("Murcia", 460), c("Palma", 420), c("Las Palmas", 380),
    c("Bilbao", 345, ["Barakaldo", "Getxo", "Portugalete"]),
    c("Alicante", 340), c("Córdoba", 320), c("Valladolid", 300), c("Vigo", 295), c("Gijón", 270),
    c("A Coruña", 245), c("Vitoria-Gasteiz", 255), c("Granada", 230), c("Elche", 235), c("Oviedo", 220),
    c("Santa Cruz de Tenerife", 210), c("Pamplona", 205), c("Almería", 200), c("San Sebastián", 190), c("Burgos", 175),
    c("Santander", 172), c("Castellón", 172), c("Albacete", 175), c("Logroño", 150), c("Badajoz", 150),
    c("Salamanca", 145), c("Huelva", 145), c("Marbella", 145), c("Lleida", 140), c("Tarragona", 135),
    c("León", 125), c("Cádiz", 115), c("Jaén", 112), c("Ourense", 105), c("Girona", 100),
    c("Lugo", 98), c("Cáceres", 96), c("Ferrol", 64), c("Ponferrada", 64), c("Algeciras", 123),
    c("Eibar", 27), c("Huesca", 53), c("Cartagena", 216), c("Mérida", 60), c("Pontevedra", 83), c("Zamora", 60),
  ],
  IT: [
    c("Roma", 2750, ["Trastevere", "Ostia", "Testaccio", "Prati", "Tor Bella Monaca"]),
    c("Milano", 1370, ["Sesto San Giovanni", "Monza", "Lambrate", "Brera"]),
    c("Napoli", 910, ["Pozzuoli", "Torre del Greco", "Fuorigrotta"]),
    c("Torino", 840, ["Moncalieri", "Collegno"]),
    c("Palermo", 630), c("Genova", 560, ["Sampierdarena", "Sestri"]), c("Bologna", 390), c("Firenze", 360),
    c("Bari", 315), c("Catania", 300), c("Venezia", 255), c("Verona", 255), c("Messina", 220),
    c("Padova", 210), c("Trieste", 200), c("Brescia", 196), c("Parma", 198), c("Taranto", 190),
    c("Prato", 195), c("Modena", 185), c("Reggio Calabria", 172), c("Reggio Emilia", 172), c("Perugia", 162),
    c("Livorno", 154), c("Ravenna", 156), c("Cagliari", 150), c("Foggia", 148), c("Rimini", 150),
    c("Salerno", 128), c("Ferrara", 130), c("Sassari", 125), c("Latina", 127), c("Bergamo", 120),
    c("Pescara", 119), c("Vicenza", 110), c("Udine", 98), c("Lecce", 95), c("Cesena", 96),
    c("Como", 84), c("Cremona", 71), c("Empoli", 48), c("Frosinone", 46), c("Avellino", 54),
    c("Benevento", 58), c("Ascoli Piceno", 46), c("Crotone", 64), c("Spezia", 93), c("Pisa", 90), c("Lucca", 89),
  ],
  DE: [
    c("Berlin", 3700, ["Köpenick", "Charlottenburg", "Kreuzberg", "Spandau", "Neukölln", "Lichtenberg", "Pankow"]),
    c("Hamburg", 1850, ["Altona", "St. Pauli", "Barmbek", "Harburg"]),
    c("München", 1500, ["Giesing", "Schwabing", "Pasing", "Unterhaching"]),
    c("Köln", 1080, ["Deutz", "Ehrenfeld", "Mülheim"]),
    c("Frankfurt", 760, ["Sachsenhausen", "Offenbach"]),
    c("Stuttgart", 630, ["Bad Cannstatt", "Degerloch"]),
    c("Düsseldorf", 620), c("Leipzig", 600), c("Dortmund", 590), c("Essen", 580), c("Bremen", 570),
    c("Dresden", 560), c("Hannover", 540), c("Nürnberg", 520), c("Duisburg", 500), c("Bochum", 365),
    c("Wuppertal", 355), c("Bielefeld", 335), c("Bonn", 330), c("Münster", 315), c("Mannheim", 310),
    c("Karlsruhe", 305), c("Augsburg", 300), c("Wiesbaden", 280), c("Gelsenkirchen", 260), c("Mönchengladbach", 260),
    c("Braunschweig", 250), c("Kiel", 245), c("Aachen", 250), c("Chemnitz", 245), c("Halle", 240),
    c("Magdeburg", 236), c("Freiburg", 230), c("Krefeld", 228), c("Mainz", 218), c("Lübeck", 216),
    c("Rostock", 209), c("Kassel", 200), c("Oberhausen", 210), c("Saarbrücken", 180), c("Paderborn", 152),
    c("Darmstadt", 160), c("Regensburg", 153), c("Würzburg", 127), c("Wolfsburg", 125), c("Ulm", 127),
    c("Heidelberg", 160), c("Osnabrück", 165), c("Fürth", 130), c("Sandhausen", 15), c("Elversberg", 13),
    c("Heidenheim", 50), c("Jena", 110), c("Erfurt", 214), c("Cottbus", 99), c("Zwickau", 87),
  ],
  FR: [
    c("Paris", 11000, ["Montreuil", "Saint-Denis", "Créteil", "Nanterre", "Boulogne-Billancourt", "Versailles", "Argenteuil", "Vincennes"]),
    c("Marseille", 870, ["Aubagne", "La Ciotat"]),
    c("Lyon", 520, ["Villeurbanne", "Vénissieux"]),
    c("Toulouse", 500), c("Nice", 345), c("Nantes", 320), c("Montpellier", 300), c("Strasbourg", 290),
    c("Bordeaux", 260), c("Lille", 235, ["Roubaix", "Tourcoing", "Villeneuve-d'Ascq"]), c("Rennes", 222), c("Reims", 182),
    c("Toulon", 180), c("Saint-Étienne", 173), c("Le Havre", 168), c("Grenoble", 157), c("Dijon", 159),
    c("Angers", 157), c("Nîmes", 150), c("Clermont-Ferrand", 147), c("Le Mans", 144), c("Aix-en-Provence", 145),
    c("Brest", 140), c("Tours", 137), c("Amiens", 135), c("Limoges", 130), c("Perpignan", 120),
    c("Metz", 118), c("Besançon", 117), c("Orléans", 116), c("Rouen", 112), c("Mulhouse", 108),
    c("Caen", 106), c("Nancy", 104), c("Avignon", 91), c("Poitiers", 89), c("La Rochelle", 77),
    c("Pau", 76), c("Lorient", 57), c("Bastia", 48), c("Ajaccio", 72), c("Auxerre", 34),
    c("Troyes", 62), c("Valenciennes", 43), c("Guingamp", 7), c("Laval", 49), c("Niort", 59),
    c("Sochaux", 4), c("Lens", 32), c("Annecy", 130), c("Quevilly", 22), c("Dunkerque", 87), c("Bourg-en-Bresse", 41),
  ],
};
