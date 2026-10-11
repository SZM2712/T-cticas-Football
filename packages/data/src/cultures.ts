// Culturas de nombres y apariencia. Los nombres son nombres y apellidos comunes en
// cada cultura; las combinaciones son aleatorias y no representan a personas reales.
//
// skin: pesos para los tonos de piel 1 (más claro) .. 6 (más oscuro) usados por los retratos.
// hair: pesos para color de pelo [negro, castaño oscuro, castaño, rubio, pelirrojo].

export interface CultureData {
  first: string[];
  last: string[];
  skin: [number, number, number, number, number, number];
  hair: [number, number, number, number, number];
  /** Probabilidad de usar dos apellidos (culturas hispanas) o un apodo de una palabra (Brasil). */
  doubleSurname?: number;
  nickname?: number;
  /** Orden apellido-nombre al mostrar el nombre completo (Asia oriental). */
  familyFirst?: boolean;
}

const w = (s: string): string[] => s.trim().split(/\s+/).map((x) => x.replace(/_/g, " "));

export const CULTURES: Record<string, CultureData> = {
  english: {
    first: w(`James Jack Harry Oliver George Charlie Thomas William Joe Ben Jacob Daniel Sam Luke Callum Ryan Lewis Jordan Connor Kieran Aaron Mason Tyler Josh Alfie Archie Louis Freddie Max Ethan Reece Jamie Liam Nathan Adam Scott Kyle Harvey Toby Rhys`),
    last: w(`Smith Jones Taylor Brown Williams Wilson Johnson Davies Robinson Wright Thompson Evans Walker White Roberts Green Hall Wood Jackson Clarke Hughes Edwards Turner Hill Moore Cooper Ward Morris King Watson Harrison Morgan Baker Allen Lee Mitchell Carter Bennett Shaw Parker Price Barnes Fletcher Holmes Marsh Pickering Hargreaves Atkinson Whitfield Lambert Chambers Sutton Fowler Brooks Bradley Saunders Dixon Gibson Pearce Webb Spencer`),
    skin: [5, 4, 1, 0, 0, 0],
    hair: [1, 4, 4, 3, 1],
  },
  irish: {
    first: w(`Sean Conor Cian Darragh Oisin Patrick Ciaran Eoin Liam Niall Shane Aidan Rory Ronan Callum Fionn Declan Kevin Dylan Jamie Ryan Cormac Padraig Tadhg Odhran`),
    last: w(`Murphy Kelly O'Sullivan Walsh O'Brien Byrne Ryan O'Connor O'Neill Doyle McCarthy Gallagher Doherty Kennedy Lynch Murray Quinn Moore McLaughlin Carroll Connolly Daly Brennan Burke Collins Campbell Clarke Fitzgerald Duffy Farrell Keane McGrath Nolan Hegarty Boyle Kavanagh Devlin Mulligan Cunningham Brady`),
    skin: [7, 3, 0, 0, 0, 0],
    hair: [1, 4, 3, 2, 2],
  },
  welsh: {
    first: w(`Rhys Gareth Dafydd Owen Aaron Ethan Ben Joe Tom Dylan Harry Kieffer Jordan Brennan Wes Neco Rubin Sion Iwan Gethin Aled Huw Cai Osian Ioan`),
    last: w(`Jones Williams Davies Evans Thomas Roberts Lewis Hughes Morgan Griffiths Edwards Owen Price Jenkins Rees Powell Pritchard Bevan Lloyd Vaughan Bowen Howells Pugh Parry Llewellyn Prosser Hopkins Watkins Probert Morris`),
    skin: [7, 3, 0, 0, 0, 0],
    hair: [1, 4, 4, 2, 1],
  },
  spanish: {
    first: w(`Alejandro Pablo Daniel Álvaro Adrián David Javier Sergio Hugo Diego Mario Iker Marcos Raúl Carlos Rubén Iván Jorge Miguel Unai Aitor Gonzalo Víctor Íñigo Asier Óscar Borja Fernando Manuel Rodrigo Jesús Nacho Dani Marc Pol Jordi Gerard Oriol Aleix Eric Bryan Samuel Fermín Martín`),
    last: w(`García Fernández González Rodríguez López Martínez Sánchez Pérez Gómez Martín Jiménez Ruiz Hernández Díaz Moreno Muñoz Álvarez Romero Alonso Gutiérrez Navarro Torres Domínguez Vázquez Ramos Gil Ramírez Serrano Blanco Molina Morales Suárez Ortega Delgado Castro Ortiz Rubio Marín Sanz Iglesias Medina Garrido Cortés Castillo Santos Lozano Guerrero Cano Prieto Méndez Calvo Gallego Vidal León Herrera Márquez Peña Cabrera Flores Campos Vega Fuentes Carrasco Diez Caballero Reyes Nieto Aguilar Pascual Santana Herrero Montero Lorenzo Hidalgo Giménez Ibáñez Ferrer Durán Santiago Benítez Mora Vicente Vargas Arias Carmona Crespo Román Pastor Soto Sáez Velasco Moya Soler Parra Esteban Bravo Gallardo Rojas Etxeberria Aguirre Goikoetxea Arrieta Puig Roca Vila`),
    skin: [3, 6, 2, 0, 0, 0],
    hair: [5, 5, 2, 0.3, 0.1],
    doubleSurname: 0.0,
  },
  latam: {
    first: w(`Juan José Luis Carlos Jorge Miguel Diego Matías Santiago Sebastián Nicolás Facundo Agustín Franco Lautaro Thiago Emiliano Gonzalo Federico Rodrigo Brian Kevin Jhon Yerson Wilmer Duván Andrés Felipe Cristian Édgar Hirving Jesús Alexis Ángel Érick Luciano Valentín Enzo Gastón Maximiliano Tomás Ezequiel Darwin Brayan Jefferson Yeferson Raúl Christian Damián`),
    last: w(`González Rodríguez Gómez Fernández López Díaz Martínez Pérez García Sánchez Romero Sosa Torres Álvarez Ruiz Ramírez Flores Acosta Benítez Medina Herrera Suárez Aguirre Giménez Gutiérrez Pereyra Rojas Molina Castro Ortiz Silva Núñez Luna Juárez Cabrera Ríos Ferreyra Godoy Morales Domínguez Moreno Peralta Vega Carrizo Quiroga Ponce Vargas Correa Cardona Mosquera Valencia Arango Zapata Ospina Mina Quiñónez Caicedo Hurtado Palacios Cuesta Rentería Montoya Estupiñán Plata Hernández Guzmán Ochoa Lozano Vela Chávez Orozco Montes Guardado Salcedo Alvarado Cortés Villalba Cáceres Arce Escobar Paredes Insaurralde Bustos`),
    skin: [1, 3, 5, 3, 1, 0.5],
    hair: [7, 4, 1, 0.2, 0],
    doubleSurname: 0.0,
  },
  portuguese: {
    first: w(`João Rodrigo Tiago Diogo Francisco Gonçalo Rafael Pedro Duarte Miguel Bernardo Rúben Nuno André Bruno Ricardo Vítor Hugo Fábio Daniel Martim Tomás Afonso Gustavo Henrique Renato Nélson Samuel Leonardo`),
    last: w(`Silva Santos Ferreira Pereira Oliveira Costa Rodrigues Martins Jesus Sousa Fernandes Gonçalves Gomes Lopes Marques Alves Almeida Ribeiro Pinto Carvalho Teixeira Moreira Correia Mendes Nunes Soares Vieira Monteiro Cardoso Rocha Neves Coelho Cruz Cunha Pires Ramos Reis Simões Antunes Matos Fonseca Machado Araújo Barbosa Tavares Lourenço Castro Figueiredo Azevedo Freitas Morais Brandão`),
    skin: [3, 6, 2, 0.5, 0, 0],
    hair: [5, 5, 2, 0.3, 0.1],
  },
  brazilian: {
    first: w(`Gabriel Lucas Matheus Pedro Guilherme Rafael Felipe Gustavo Vinícius Bruno Thiago Rodrigo Leonardo Eduardo Caio Igor Douglas Wesley Everton Danilo Raphael Paulo Antônio Luan Renan João Murilo Kaio Yuri Talles Willian Arthur Diego`),
    last: w(`Silva Santos Oliveira Souza Rodrigues Ferreira Alves Pereira Lima Gomes Costa Ribeiro Martins Carvalho Almeida Lopes Soares Fernandes Vieira Barbosa Rocha Dias Nascimento Andrade Moreira Nunes Marques Machado Mendes Freitas Cardoso Ramos Gonçalves Santana Teixeira Araújo Correia Moraes Batista Monteiro Pinheiro Campos Cunha Reis Castro Brito Bezerra Cavalcanti Fonseca Mota Xavier Paixão Guimarães`),
    skin: [1, 2, 3, 3, 3, 2],
    hair: [6, 4, 1.5, 0.4, 0.1],
    nickname: 0.35,
  },
  italian: {
    first: w(`Lorenzo Alessandro Francesco Andrea Matteo Leonardo Gabriele Riccardo Tommaso Davide Federico Nicolò Simone Marco Luca Giuseppe Giovanni Pietro Edoardo Filippo Samuele Daniele Mattia Christian Stefano Fabio Alberto Michele Gianluca Emanuele Raffaele Manuel Giacomo Vincenzo Salvatore Domenico Ciro Gennaro Sandro`),
    last: w(`Rossi Russo Ferrari Esposito Bianchi Romano Colombo Ricci Marino Greco Bruno Gallo Conti De_Luca Mancini Costa Giordano Rizzo Lombardi Moretti Barbieri Fontana Santoro Mariani Rinaldi Caruso Ferrara Galli Martini Leone Longo Gentile Martinelli Vitale Lombardo Serra Coppola De_Santis D'Angelo Marchetti Parisi Villa Conte Ferraro Ferri Fabbri Bianco Marini Grasso Valentini Messina Sala De_Angelis Gatti Pellegrini Palumbo Sanna Farina Rizzi Monti Cattaneo Morelli Amato Silvestri Mazza Testa Grassi Pellegrino Carbone Giuliani Benedetti Barone Rossetti Caputo Montanari Guerra Palmieri Bernardi Martino Fiore De_Rosa Ferretti Bellini Basile Riva Donati Piras Vitali Battaglia Sartori Neri Costantini Milani Pagano Ruggiero Sorrentino`),
    skin: [3, 6, 2, 0, 0, 0],
    hair: [5, 5, 2, 0.4, 0.1],
  },
  german: {
    first: w(`Lukas Leon Finn Jonas Luca Felix Paul Maximilian Niklas Tim Jan Julian Moritz Florian Tobias Kevin Marco Dennis Philipp Sebastian Fabian Benjamin Nico Robin Timo Kai Leroy Joshua Jamal Lennart Malte Marvin Pascal Patrick Sven Thilo Yannick Hendrik Mats Manuel Thomas Toni Matthias Christoph`),
    last: w(`Müller Schmidt Schneider Fischer Weber Meyer Wagner Becker Schulz Hoffmann Koch Bauer Richter Klein Wolf Schröder Neumann Schwarz Zimmermann Braun Krüger Hofmann Hartmann Lange Schmitt Werner Schmitz Krause Meier Lehmann Schmid Schulze Maier Köhler Herrmann König Walter Mayer Huber Kaiser Fuchs Peters Lang Scholz Möller Weiß Jung Hahn Schubert Vogel Friedrich Keller Günther Frank Berger Winkler Roth Beck Lorenz Baumann Franke Albrecht Schuster Simon Ludwig Böhm Winter Kraus Martin Schumacher Krämer Vogt Stein Jäger Otto Sommer Groß Seidel Heinrich Brandt Haas Schreiber Graf Schulte Dietrich Ziegler Kuhn Kühn Pohl Engel Horn Busch Bergmann Thomas Voigt Sauer Arnold Wolff Pfeiffer`),
    skin: [6, 3, 1, 0, 0, 0],
    hair: [1, 4, 4, 4, 0.5],
  },
  french: {
    first: w(`Lucas Hugo Louis Gabriel Arthur Jules Nathan Léo Raphaël Adam Théo Mathis Enzo Tom Maxime Antoine Alexandre Thomas Nicolas Julien Romain Kylian Benjamin Clément Florian Quentin Baptiste Valentin Corentin Mathieu Yanis Rayan Ryan Kevin Anthony Jordan Dylan Mattéo Noah Aurélien Jérémy Bastien Loïc`),
    last: w(`Martin Bernard Dubois Thomas Robert Richard Petit Durand Leroy Moreau Simon Laurent Lefebvre Michel Garcia David Bertrand Roux Vincent Fournier Morel Girard André Lefèvre Mercier Dupont Lambert Bonnet François Martinez Legrand Garnier Faure Rousseau Blanc Guerin Muller Henry Roussel Nicolas Perrin Morin Mathieu Clement Gauthier Dumont Lopez Fontaine Chevalier Robin Masson Sanchez Gérard Nguyen Boyer Denis Lemaire Duval Joly Gautier Roger Roche Roy Noël Meyer Lucas Meunier Jean Perez Marchand Dufour Blanchard Marie Barbier Brun Dumas Brunet Schmitt Leroux Colin Fernandez Pierre Renard Arnaud Rolland Caron Aubert Giraud Leclerc Vidal Bourgeois Renaud Lemoine Picard Gaillard Philippe Leclercq Lacroix Fabre Dupuis`),
    skin: [5, 4, 1.5, 0.5, 0, 0],
    hair: [3, 5, 3, 1.5, 0.3],
  },
  westAfricaFr: {
    first: w(`Moussa Ibrahima Mamadou Abdoulaye Ousmane Cheikh Sadio Idrissa Pape Souleymane Bakary Lamine Youssouf Seydou Boubacar Amadou Kalidou Ismaïla Saliou Yves Serge Franck Wilfried Jean-Philippe Didier Eric Christian Nicolas Hervé Arnaud Fodé Habib Alassane Kader Ibrahim Jules Désiré Ange Junior Thierry Steve Brice`),
    last: w(`Diallo Diop Ndiaye Sow Fall Faye Ba Cissé Traoré Coulibaly Konaté Camara Keita Touré Koné Sylla Sissoko Bamba Kouyaté Diarra Doumbia Sangaré Diakité Dembélé Gueye Mendy Sarr Niang Kanté Fofana Ouattara Yao Kouassi Kouamé N'Guessan Sanogo Dabo Ilboudo Kaboré`),
    skin: [0, 0, 0, 0.5, 3, 6],
    hair: [9, 1, 0, 0, 0],
  },
  westAfricaEn: {
    first: w(`Emmanuel Samuel Victor Kelechi Ahmed Wilfred Alex Joe Chidera Chukwuemeka Kingsley Ola Taiwo Kehinde Tunde Femi Seyi Daniel Kwame Kofi Kwadwo Yaw Thomas Mohammed Jordan Andre Jeffrey Mubarak Abdul Tariq Calvin Ebere Moses Felix Ikechukwu`),
    last: w(`Okafor Okonkwo Adeyemi Ogunleye Eze Nwosu Musa Simon Onyeka Ajayi Balogun Mensah Boateng Asamoah Owusu Opoku Sarfo Agyemang Antwi Annan Appiah Ofori Nkansah Darko Badu Acheampong Osei Bonsu Quaye Amankwah`),
    skin: [0, 0, 0, 0.5, 3, 6],
    hair: [9, 1, 0, 0, 0],
  },
  caribbean: {
    first: w(`Andre Leon Shamar Damion Jermaine Kemar Bobby Kevin Leroy Dexter Renaldo Tyreek Shaquille Keon Junior Mason Ricardo Wes Jean-Kévin Derrick`),
    last: w(`Brown Williams Campbell Thompson Morrison Gordon Bailey Lowe Reid Bell Watson Gray Bryan Leigh Mason Pierre Jérôme Martina Lewis Hector Grant Wright Johnson Bernard Charles Francis Marcelin`),
    skin: [0, 0, 0.5, 2, 4, 4],
    hair: [9, 1, 0, 0, 0],
  },
  dutch: {
    first: w(`Daan Sem Lucas Levi Finn Milan Jesse Bram Thijs Ruben Luuk Stijn Tim Jasper Wout Teun Joey Brian Kenneth Davy Wesley Robin`),
    last: w(`de_Jong Jansen de_Vries van_den_Berg van_Dijk Bakker Janssen Visser Smit Meijer de_Boer Mulder de_Groot Bos Vos Peters Hendriks van_Leeuwen Dekker Brouwer de_Wit Dijkstra Smits de_Graaf van_der_Meer van_der_Linden Kok Jacobs de_Haan Vermeulen van_den_Heuvel van_der_Veen van_den_Broek de_Bruijn de_Bruin van_der_Heijden Schouten van_Beek Willems van_Vliet van_de_Ven Hoekstra Maas Verhoeven Koster van_Dam van_der_Wal Prins Blom Huisman Timmermans`),
    skin: [6, 3, 1, 0.5, 0.5, 0.5],
    hair: [1, 4, 4, 4, 0.5],
  },
  nordic: {
    first: w(`Erik Lars Anders Mikkel Rasmus Kasper Mads Jonas Emil Oscar Viktor Gustav William Elias Alexander Martin Kristoffer Sander Magnus Henrik Joachim Andreas Simon Jesper Christian Nils Johan Hugo Isak Albin Sindre Fredrik Haakon Aron Jóhann Ragnar`),
    last: w(`Hansen Johansen Olsen Larsen Andersen Pedersen Nielsen Kristiansen Jensen Karlsen Johnsen Pettersen Eriksen Berg Haugen Hagen Johannessen Andreassen Jacobsen Dahl Jørgensen Halvorsen Henriksen Lund Sørensen Christensen Rasmussen Poulsen Madsen Kristensen Thomsen Johansson Andersson Karlsson Nilsson Eriksson Larsson Olsson Persson Svensson Gustafsson Pettersson Jonsson Lindberg Lindqvist Lindström Bergström Lundqvist Holm Sigurðsson Gunnarsson Jónsson Magnússon Haraldsson`),
    skin: [8, 2, 0, 0, 0, 0],
    hair: [0.5, 2, 4, 6, 0.5],
  },
  finnish: {
    first: w(`Teemu Joel Lukas Jere Robin Fredrik Rasmus Daniel Pyry Onni Eetu Aleksi Juho Leo Niko Sami Jari Mikael Oliver Juhani Kaan Topi Tuomas Petteri`),
    last: w(`Korhonen Virtanen Mäkinen Nieminen Mäkelä Hämäläinen Laine Heikkinen Koskinen Järvinen Lehtonen Lehtinen Saarinen Salminen Heinonen Niemi Heikkilä Kinnunen Salonen Turunen Salo Laitinen Tuominen Rantanen Karjalainen Jokinen Mattila Savolainen Lahtinen Ahonen`),
    skin: [9, 1, 0, 0, 0, 0],
    hair: [0.5, 2, 4, 6, 0.5],
  },
  polish: {
    first: w(`Jakub Kacper Szymon Mateusz Bartosz Michał Filip Wojciech Piotr Kamil Krzysztof Łukasz Tomasz Paweł Adam Dawid Marcin Grzegorz Przemysław Sebastian Arkadiusz Karol Damian Robert Jan Patryk Sylwester Maciej Mikołaj Oskar`),
    last: w(`Nowak Kowalski Wiśniewski Wójcik Kowalczyk Kamiński Lewandowski Zieliński Szymański Woźniak Dąbrowski Kozłowski Jankowski Mazur Kwiatkowski Krawczyk Kaczmarek Piotrowski Grabowski Zając Pawłowski Michalski Król Wieczorek Jabłoński Wróbel Nowakowski Majewski Olszewski Stępień Malinowski Jaworski Adamczyk Dudek Nowicki Pawlak Górski Witkowski Walczak Sikora Baran Rutkowski Michalak Szewczyk Ostrowski Tomaszewski Pietrzak Zalewski Wróblewski Marciniak`),
    skin: [8, 2, 0, 0, 0, 0],
    hair: [1, 4, 4, 3, 0.4],
  },
  czechSlovak: {
    first: w(`Jakub Jan Tomáš Lukáš Matěj Adam Ondřej Vojtěch Filip David Petr Martin Michal Pavel Patrik Marek Ladislav Vladimír Milan Stanislav Juraj Dominik Róbert Peter Ivan Denis Antonín Václav Jiří Tobiáš`),
    last: w(`Novák Svoboda Novotný Dvořák Černý Procházka Kučera Veselý Horák Němec Marek Pospíšil Pokorný Hájek Král Jelínek Růžička Beneš Fiala Sedláček Doležal Zeman Kolář Navrátil Čermák Vaněk Urban Blažek Kříž Kovács Horváth Varga Tóth Nagy Baláž Molnár Szabó Lukáč Kratochvíl Kopecký Holub Bartoš Šimek Vlček Polák Musil Krejčí Matoušek Bureš Mareš`),
    skin: [8, 2, 0, 0, 0, 0],
    hair: [1, 4, 4, 3, 0.4],
  },
  hungarian: {
    first: w(`Bence Máté Levente Dominik Ádám Dániel Balázs Gergő Péter Zsolt Roland Attila Krisztián Tamás László Dávid Milos Barnabás Botond Zalán Kristóf Márton Norbert Gábor Szabolcs`),
    last: w(`Nagy Kovács Tóth Szabó Horváth Varga Kiss Molnár Németh Farkas Balogh Papp Takács Juhász Lakatos Mészáros Oláh Simon Rácz Fekete Szilágyi Török Fehér Balázs Gál Kis Szűcs Kocsis Orsós Pintér Fodor Szalai Sipos Magyar Lukács Gulyás Biró Király Katona László Bognár Pásztor Hegedűs Csonka Vida Bodnár Halász Antal Bakó`),
    skin: [7, 3, 0, 0, 0, 0],
    hair: [2, 5, 3, 2, 0.3],
  },
  romanian: {
    first: w(`Andrei Alexandru Ionuț Mihai Ștefan Gabriel Cristian Florin Răzvan Nicolae Vlad Denis Dennis Darius Radu Valentin Bogdan Constantin Dragoș Marius George Adrian Rareș Octavian Cătălin Sorin Nicușor Deian Horațiu`),
    last: w(`Popescu Ionescu Popa Pop Radu Dumitru Stan Stoica Gheorghe Matei Ciobanu Rusu Munteanu Constantin Moldovan Dinu Serban Marin Ene Tudor Lazăr Mocanu Barbu Nistor Florea Dobre Iordache Neagu Sârbu Ilie Lungu Toma Voicu Cojocaru Diaconu Ursu Neagoe Pavel Stoian Preda Vasile`),
    skin: [5, 5, 0.5, 0, 0, 0],
    hair: [3, 5, 2, 1, 0.2],
  },
  southSlavic: {
    first: w(`Luka Ivan Marko Nikola Filip Stefan Aleksandar Dušan Milan Mateo Josip Ante Mario Dejan Nemanja Vladimir Bojan Mihailo Lazar Andrej Sergej Strahinja Darko Edin Miralem Ermedin Haris Benjamin Amer Jasmin Petar Kristijan Dominik Borna Lovro Mislav Duje Domagoj Branimir Goran Zoran Jan Žan Jaka Timi Tomaž`),
    last: w(`Horvat Kovačević Babić Marić Jurić Novak Kovačić Knežević Vuković Marković Petrović Pavlović Nikolić Jovanović Đorđević Stojanović Ilić Stanković Popović Milošević Mitrović Kostić Lukić Petrov Georgiev Dimitrov Ivanov Kostadinov Vidović Bošnjak Begić Hodžić Mehmedović Krasić Grgić Matić Šimić Kolar Zupan Kos Mlakar Vidmar Golob Kranjc Petkov Iliev Hristov Todorov Stoyanov Angelov`),
    skin: [6, 4, 0.3, 0, 0, 0],
    hair: [3, 5, 3, 1, 0.2],
  },
  albanian: {
    first: w(`Arbër Ardit Arlind Armando Berat Besart Bekim Blerim Dardan Drilon Edon Endrit Ermir Etrit Florent Ilir Kristjan Leart Lirim Milot Nedim Taulant Valon Vedat Xhelil Agon Albian`),
    last: w(`Hoxha Krasniqi Berisha Gashi Shala Morina Kelmendi Bytyqi Rexhepi Hasani Ahmeti Aliu Mehmeti Zeqiri Bajrami Gjoka Leka Dushku Shehu Rama Kola Prenga Marku Dervishi Kaja Gjini Hyseni Osmani Mustafa Latifi Halili Sylejmani`),
    skin: [5, 5, 0.3, 0, 0, 0],
    hair: [5, 4, 1, 0.3, 0.1],
  },
  greek: {
    first: w(`Giorgos Dimitris Konstantinos Nikos Giannis Christos Panagiotis Vasilis Thanasis Michalis Kostas Stelios Anastasios Petros Fotis Tasos Lefteris Pantelis Sotiris Andreas Alexandros Charalampos Manolis Stavros Fanis`),
    last: w(`Papadopoulos Papadakis Georgiou Oikonomou Nikolaidis Vlachos Karagiannis Ioannou Konstantinidis Pappas Dimitriou Antoniou Makris Christodoulou Athanasiou Angelopoulos Papanikolaou Michailidis Theodorou Papadimitriou Alexiou Kyriakou Stavrou Lazaridis Papazoglou Anagnostou Karalis Spanos Raptis Bouras Doukas Kollias Tsakiris Galanis Panagiotou Sideris Kalogeropoulos Vergos`),
    skin: [3, 6, 1, 0, 0, 0],
    hair: [6, 4, 1, 0.2, 0],
  },
  turkish: {
    first: w(`Mehmet Ahmet Mustafa Ali Hüseyin Hasan İbrahim Emre Burak Cengiz Hakan Arda Kerem Ferdi Kenan Orkun Barış Zeki Salih Merih Çağlar Ozan Kaan Mert Uğurcan Yunus Okay İrfan Abdülkerim Semih Bertuğ Cenk Can Enes Yusuf Oğuz Eren Halil Berkay Altay`),
    last: w(`Yılmaz Kaya Demir Şahin Çelik Yıldız Yıldırım Öztürk Aydın Özdemir Arslan Doğan Kılıç Aslan Çetin Kara Koç Kurt Özkan Şimşek Polat Korkmaz Özer Akın Ünal Çakır Erdoğan Aktaş Tekin Güneş Bulut Karaca Yazıcı Avcı Turan Bozkurt Kalkan Özcan`),
    skin: [3, 6, 1.5, 0.3, 0, 0],
    hair: [7, 4, 0.5, 0.1, 0],
  },
  eastSlavic: {
    first: w(`Aleksandr Dmitriy Maksim Ivan Artem Mykhailo Andriy Oleksandr Vitaliy Serhiy Taras Ruslan Roman Viktor Yevhen Denys Ilya Kirill Nikita Pavel Mikhail Anton Daniil Vladyslav Bohdan Heorhiy Mykola Yaroslav Volodymyr Oleh Anatoliy Artur Igor Sergey Yuriy Matvey Fedor Arseniy`),
    last: w(`Ivanov Smirnov Kuznetsov Popov Vasiliev Petrov Sokolov Mikhailov Novikov Fedorov Morozov Volkov Alekseev Lebedev Semenov Egorov Pavlov Kozlov Stepanov Nikolaev Orlov Andreev Makarov Zakharov Shevchenko Kovalenko Bondarenko Tkachenko Kravchenko Oliynyk Shevchuk Polishchuk Lysenko Melnyk Moroz Marchenko Rudenko Savchenko Belov Tarasov Gusev Titov Kuzmin Romanov Frolov Melnikov Gerasimov Sorokin Boyko Tkachuk Kovalchuk Hrytsenko Pavlenko Didenko Hnatenko Ponomarenko Levchenko`),
    skin: [9, 1, 0, 0, 0, 0],
    hair: [1, 4, 4, 3, 0.4],
  },
  baltic: {
    first: w(`Jānis Andris Edgars Kristaps Roberts Dāvis Artūrs Mārtiņš Raivis Vladislavs Lukas Matas Domantas Gvidas Justas Paulius Tomas Mantas Edvinas Arvydas Rokas Deividas Gytis Nojus Eimantas`),
    last: w(`Bērziņš Kalniņš Ozoliņš Jansons Liepiņš Kļaviņš Krūmiņš Zariņš Pētersons Vītols Kazlauskas Jankauskas Petrauskas Stankevičius Vasiliauskas Žukauskas Butkus Paulauskas Urbonas Kavaliauskas Ozols Zālītis Kalējs Krastiņš Balodis Vasiļjevs Sadauskas Mockus Navickas Rimkus Jonaitis Žemaitis Vaitkus Baranauskas`),
    skin: [9, 1, 0, 0, 0, 0],
    hair: [0.5, 3, 4, 5, 0.4],
  },
  caucasian: {
    first: w(`Giorgi Levan Davit Nika Luka Saba Otar Zuriko Guram Lasha Tornike Vako Aram Armen Hovhannes Tigran Narek Gor Vardan Eduard Ramil Emin Mahir Rustam Tural Anar Elvin Toral`),
    last: w(`Beridze Kapanadze Gelashvili Hakobyan Petrosyan Sargsyan Harutyunyan Grigoryan Mammadov Aliyev Huseynov Hasanov Guliyev Ismayilov Abdullayev Kiknadze Lomidze Japaridze Tsereteli Abashidze Gogichaishvili Maisuradze Vardanyan Avetisyan Karapetyan Gasparyan Babayev Rzayev Najafov Karimov Qasimov`),
    skin: [5, 5, 0.3, 0, 0, 0],
    hair: [7, 4, 0.5, 0.1, 0],
  },
  hebrew: {
    first: w(`Yonatan Noam Itay Omer Eran Dor Liel Tai Gavriel Eli Shon Oscar Mohammad Dan Roy Idan Yoav Ido Ariel Daniel Nir Tomer Amir Raz Sagiv Neta Stav`),
    last: w(`Cohen Levi Mizrahi Peretz Biton Dahan Avraham Friedman Azulay Malka Katz Yosef David Amar Ohana Hadad Gabay Ben_David Shitrit Solomon Lavi Shapira Ashkenazi Golan Sasson Elbaz Vaknin Yitzhak Tal Shalom`),
    skin: [3, 5, 2, 0.3, 0, 0],
    hair: [6, 4, 1, 0.3, 0.1],
  },
  centralAsian: {
    first: w(`Otabek Jamshid Sherzod Igor Islom Azizbek Dostonbek Umarbek Bakhrom Islambek Maxat Abat Nurlan Daulet Askhat Ruslan Sanzhar Timur Bekzod Javohir Sardor Aziz Farrukh Alisher Dilshod Arman Nursultan`),
    last: w(`Tursunov Hamraev Islomov Astanov Valiev Sadikov Rakhimov Karimov Yusupov Rashidov Nazarov Umarov Saidov Mirzaev Kurbanov Akhmedov Nurmagambetov Seitkali Omarov Zhumabekov Suleimenov`),
    skin: [3, 6, 2, 0.3, 0, 0],
    hair: [8, 3, 0.3, 0.1, 0],
  },
  maltese: {
    first: w(`Luke Jake Kurt Joseph Andrei Matthew Zach Jean Teddy Yannick Ryan Steve Kyrian Juan Jodi Alexander Paul Clayton Kemar Henry`),
    last: w(`Borg Camilleri Vella Farrugia Zammit Galea Micallef Grech Attard Spiteri Azzopardi Mifsud Agius Pace Sammut Caruana Gatt Cassar Muscat Mallia Bonello Calleja`),
    skin: [3, 6, 1, 0, 0, 0],
    hair: [6, 4, 1, 0.2, 0],
  },
  lusophoneAfrica: {
    first: w(`Ryan Gilson Dylan Hélio Nuno Rúben Domingos Bruno Clinton Manuel Mateus Wilson João Carlos Edson Mário Adilson Nelson Ivanildo Ailton Elton Márcio`),
    last: w(`Rodrigues Monteiro Tavares Semedo Lopes Fernandes Cabral Mendes Varela Borges Pina Moreira Fortes Andrade Costa Gaspar Ribeiro Bastos Mané Baldé Gomes Santos Silva Neto Évora Delgado Brito Spencer Graça`),
    skin: [0, 0, 0.5, 2, 4, 4],
    hair: [9, 1, 0, 0, 0],
  },
  southernAfrica: {
    first: w(`Thabo Sipho Themba Bongani Siyabonga Thapelo Lebogang Aubrey Enock Kings Emmanuel Edward Lucky Tshepo Mandla Kagiso Lwazi Musa Chanda Mwila Mumba`),
    last: w(`Mokoena Nkosi Dlamini Khumalo Ndlovu Zulu Mthembu Mahlangu Sithole Ngcobo Mabaso Foster Williams Banda Phiri Sakala Musonda Chirwa`),
    skin: [0.3, 0.3, 0.5, 1, 4, 5],
    hair: [9, 1, 0, 0, 0],
  },
  eastAfrica: {
    first: w(`Joseph Michael Emmanuel Allan Farouk Khalid Steven Victor Ismail Simon Feisal Mbaraka Kelvin Bashir Brian Erick Dennis Patrick Ali Dickson Elvis Moses`),
    last: w(`Omondi Otieno Ochieng Kimani Mwangi Kamau Odhiambo Okumu Oluoch Job Onyango Okello Kayondo Sserunkuma Mutua Njoroge Wafula Kiprono Juma Bakari Salim Mohamed Hassan Abdallah Mugisha Ssemakula Kato Nsubuga Tumusiime`),
    skin: [0, 0, 0, 0.5, 3, 6],
    hair: [9, 1, 0, 0, 0],
  },
  arabic: {
    first: w(`Mohamed Ahmed Youssef Omar Ali Hamza Hakim Sofiane Ismaël Yassine Bilal Karim Mehdi Amine Anass Ilias Brahim Zakaria Adam Hicham Walid Fahad Abdullah Saud Hassan Khalid Salman Firas Mahmoud Tarek Ayman Amr Mostafa Rami Nabil Saad Hussein Ibrahim`),
    last: w(`El_Amrani Benali Belkacem Mansouri Haddad Bouzid Ziani Saïdi Hamdi Fathy Ashour Hassan Hussein Alaoui Bennani Tazi Berrada Idrissi Chraibi Benjelloun Lahlou Brahimi Meziane Boukhari Kaddour Hamadi Rahmani Belhadj Trabelsi Jaziri Ben_Youssef Nasser Al-Harbi Al-Qahtani Al-Otaibi Al-Ghamdi Al-Zahrani Al-Mutairi Al-Shammari Al-Ali Al-Saadi Al-Jabri Abdelaziz Mostafa Saber Gaber Morsi Kamal Fouad Abdelrahman Ismail Khalil Mansour`),
    skin: [1.5, 5, 3, 1, 0.3, 0],
    hair: [8, 3, 0.3, 0.1, 0],
  },
  persian: {
    first: w(`Mehdi Alireza Ali Mohammad Hossein Saeid Ehsan Saman Majid Milad Ramin Morteza Amir Omid Hamed Reza Karim Vahid Sadegh Abolfazl Hadi`),
    last: w(`Ahmadi Hosseini Mohammadi Rezaei Moradi Karimi Hashemi Jafari Rahimi Ghasemi Sadeghi Mousavi Kazemi Ebrahimi Hosseinzadeh Najafi Sharifi Akbari Bagheri Salehi Amini Heidari Mirzaei Abbasi Yousefi Nazari Zare Asadi Shahbazi Tavakoli`),
    skin: [3, 6, 1.5, 0.2, 0, 0],
    hair: [8, 3, 0.3, 0.1, 0],
  },
  japanese: {
    first: w(`Daichi Yuto Shogo Reo Hiroki Takuma Shuto Yuki Ryo Sota Kento Yuya Koki Taishi Haruto Yuma Riku Kaito Hinata Kenta Shota Naoki Takuya Daiki Yusuke Tatsuya Kazuki Ryota Shun Hayato Masaki`),
    last: w(`Sato Suzuki Takahashi Tanaka Watanabe Ito Yamamoto Nakamura Kobayashi Kato Yoshida Yamada Sasaki Yamaguchi Matsumoto Inoue Kimura Hayashi Shimizu Yamazaki Mori Abe Ikeda Hashimoto Ishikawa Ogawa Okada Goto Hasegawa Murakami Kondo Ishii Saito Sakamoto Endo Aoki Fujii Nishimura Fukuda Ota Miura Fujiwara Okamoto Matsuda Nakagawa Nakano Harada Ono Tamura Takeuchi`),
    skin: [3, 7, 0.5, 0, 0, 0],
    hair: [9, 1, 0, 0, 0],
    familyFirst: true,
  },
  korean: {
    first: w(`Min-jun Seo-jun Do-yun Ye-jun Si-woo Ha-jun Ji-ho Joo-won Ji-hoon Jun-seo Hyun-woo Dong-hyun Sung-min Jae-won Tae-yang Woo-jin Sang-woo Jin-woo Yong-jun Kyung-min Han-gyeol Seung-woo Jae-hyun Min-seok`),
    last: w(`Kim Lee Park Choi Jung Kang Cho Yoon Jang Lim Han Oh Seo Shin Kwon Hwang Ahn Song Jeon Hong Yoo Moon Yang Son Bae Baek Heo Nam Noh`),
    skin: [3, 7, 0.5, 0, 0, 0],
    hair: [9, 1, 0, 0, 0],
    familyFirst: true,
  },
  chinese: {
    first: w(`Wei Hao Jun Tao Jie Peng Bin Yang Chao Lin Kai Xiang Yu Zhen Yi Ming Qiang Long Fei Shuai Ze Rui Xin Zihao Haoran Yuxuan Junjie Zhiwei Jianguo Tianyu Mingxuan Chenyu Jiahao`),
    last: w(`Wang Li Zhang Liu Chen Yang Huang Zhao Wu Zhou Xu Sun Ma Zhu Hu Guo He Gao Lin Luo Zheng Liang Xie Song Tang Han Feng Deng Cao Peng Zeng Xiao Tian Dong Yuan Pan Cai Jiang Yu Du Ye Cheng Wei Su Lü Ding Ren Shen Yao Lu Cui Zhong Tan`),
    skin: [3, 7, 0.5, 0, 0, 0],
    hair: [9, 1, 0, 0, 0],
    familyFirst: true,
  },
  thai: {
    first: w(`Somchai Somsak Anan Kittisak Natthapong Chaiwat Sakda Wichai Thanawat Phongsak Prasert Surasak Kittipong Apichat Nattawut Sitthichok Warut Thanakorn Jakkrit Pongsakorn`),
    last: w(`Saetang Srisuk Wongsakul Chaiyaporn Rattanakul Boonmee Thongdee Kaewmanee Sukprasert Phromma Jaidee Chanthawong Sombat Suwannarat Khamsuk Inthasorn Saengthong Phonsawan Wattana Siriwan`),
    skin: [1, 5, 4, 1, 0, 0],
    hair: [9, 1, 0, 0, 0],
  },
  vietnamese: {
    first: w(`Văn_Minh Đức_Anh Minh_Khôi Hoàng_Nam Quốc_Bảo Gia_Huy Thanh_Tùng Văn_Long Hữu_Phước Minh_Quân Đăng_Khoa Tuấn_Kiệt Thành_Đạt Anh_Tuấn Văn_Khánh Đức_Thịnh Quang_Vinh Hữu_Thắng Bảo_Long Trọng_Nghĩa`),
    last: w(`Nguyễn Trần Lê Phạm Hoàng Huỳnh Phan Vũ Võ Đặng Bùi Đỗ Hồ Ngô Dương Lý Đoàn Đinh Trương Cao`),
    skin: [2, 6, 2, 0.3, 0, 0],
    hair: [9, 1, 0, 0, 0],
    familyFirst: true,
  },
  indonesian: {
    first: w(`Adi Budi Agus Dedi Eko Fajar Hendra Irfan Joko Rudi Yudi Andi Bayu Dimas Rizal Arif Fauzi Teguh Wahyu Bagas Ilham Reza Galih Yoga Fikri`),
    last: w(`Saputra Pratama Wijaya Santoso Hidayat Setiawan Kurniawan Nugroho Susanto Gunawan Siregar Simanjuntak Lubis Nasution Harahap Hutapea Sitompul Tambunan Wibowo Firmansyah Ramadhan Syahputra Utomo Purnomo Hakim`),
    skin: [1, 4, 4, 1.5, 0.3, 0],
    hair: [9, 1, 0, 0, 0],
  },
  pacific: {
    first: w(`Tevita Viliame Sitiveni Iosefo Sione Kalo Josaia Ratu Semi Apenisa Manasa Tomasi Teva Hiro Moana Teiva Heimana Rauhiti Kevin Jordan`),
    last: w(`Naivalu Ratu Tuilagi Vakacegu Bulitavu Rokobaro Tabua Nadolo Lealaiauloto Taufa Fifita Havili Pouono Teriitahi Tehaamoana Tetuanui Faatau Mai Temarii Kaimu`),
    skin: [0.3, 1, 3, 5, 2, 0.5],
    hair: [9, 1, 0, 0, 0],
  },
};

/** Nombres de una sola palabra al estilo brasileño (se combinan con sufijos y diminutivos). */
export const BRAZILIAN_NICKNAMES = w(
  `Zezinho Pedrinho Tiquinho Luizão Edu Tché Dudu Neném Tuta Toró Thiaguinho Léo Biro Caio Gerson Duda Netinho Bruninho Tetê Guga Kiko Zeca Nando Tonho Fernandinho Joãozinho Chiquinho Dinho`,
);
