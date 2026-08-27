import { City } from '../types';

export const CITIES: City[] = [
  {
    id: 'nyc',
    name: 'New York City',
    country: 'United States',
    countryCode: 'US',
    center: [40.7484, -73.9857],
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 18,
    description: 'The iconic grid and diagonal avenues of Manhattan and historic Brooklyn.',
    features: [
      {
        id: 'nyc_broadway',
        name: 'Broadway',
        type: 'avenue',
        cityId: 'nyc',
        center: [40.7590, -73.9845],
        path: [
          [40.7050, -74.0130], // Bowling Green
          [40.7128, -74.0060], // City Hall
          [40.7250, -73.9960], // SoHo
          [40.7410, -73.9897], // Flatiron
          [40.7580, -73.9855], // Times Square
          [40.7725, -73.9818], // Columbus Circle
          [40.7900, -73.9750], // Upper West Side
        ],
        funFact: 'Broadway originated as the Wickquasgeck trail carved through Manhattan brush by Native Americans before European settlers arrived.',
        clues: [
          'Known as "The Great White Way" through the theater district.',
          'One of the few avenues that cuts diagonally across the Manhattan rectangular grid.',
          'Passes through Columbus Circle, Times Square, and Union Square.',
        ],
        distractors: ['Fifth Avenue', 'Lexington Avenue', 'Park Avenue', 'Madison Avenue'],
        difficulty: 'easy',
      },
      {
        id: 'nyc_fifth_ave',
        name: 'Fifth Avenue',
        type: 'avenue',
        cityId: 'nyc',
        center: [40.7745, -73.9654],
        path: [
          [40.7308, -73.9973], // Washington Square Arch
          [40.7411, -73.9897], // Flatiron
          [40.7484, -73.9857], // Empire State Bldg
          [40.7587, -73.9787], // Rockefeller Center
          [40.7640, -73.9730], // Plaza Hotel / Central Park S
          [40.7794, -73.9632], // The Met / Museum Mile
          [40.7950, -73.9520], // Upper East Side north
        ],
        funFact: 'Fifth Avenue acts as the official dividing line between Manhattan’s East Side and West Side street numbers.',
        clues: [
          'Home to "Museum Mile" alongside Central Park.',
          'Anchored at its southern terminus by the Washington Square Arch.',
          'Famous for high-end luxury boutiques and the Empire State Building.',
        ],
        distractors: ['Broadway', 'Madison Avenue', 'Park Avenue', 'Sixth Avenue (Avenue of the Americas)'],
        difficulty: 'easy',
      },
      {
        id: 'nyc_wall_street',
        name: 'Wall Street',
        type: 'street',
        cityId: 'nyc',
        center: [40.7070, -74.0090],
        path: [
          [40.7078, -74.0116], // Trinity Church
          [40.7069, -74.0090], // NYSE / Federal Hall
          [40.7058, -74.0055], // Water St
          [40.7048, -74.0033], // South St
        ],
        funFact: 'Named after a 17th-century wooden stockade wall built by Dutch settlers to protect New Amsterdam from Native Americans and British forces.',
        clues: [
          'The eight-block historic center of American high finance.',
          'Home to the New York Stock Exchange and Federal Hall.',
          'Located in Lower Manhattan near Trinity Church.',
        ],
        distractors: ['Broad Street', 'Fulton Street', 'Canal Street', 'Chambers Street'],
        difficulty: 'easy',
      },
      {
        id: 'nyc_high_line',
        name: 'The High Line',
        type: 'park',
        cityId: 'nyc',
        center: [40.7480, -74.0048],
        path: [
          [40.7395, -74.0080], // Gansevoort St (Meatpacking)
          [40.7445, -74.0060], // 14th St Chelsea
          [40.7490, -74.0035], // 23rd St
          [40.7540, -74.0020], // 30th St
          [40.7555, -74.0010], // Hudson Yards loop
        ],
        funFact: 'Built on a historic elevated freight rail line abandoned in 1980, now transformed into a 1.45-mile linear botanical park.',
        clues: [
          'Elevated linear public park winding through Chelsea and Meatpacking.',
          'Repurposed freight viaduct hovering 30 feet above street level.',
          'Terminates near Hudson Yards and The Vessel.',
        ],
        distractors: ['Central Park Mall', 'Hudson River Greenway', 'Battery Park Esplanade', 'Brooklyn Bridge Park'],
        difficulty: 'medium',
      },
      {
        id: 'nyc_brooklyn_bridge',
        name: 'Brooklyn Bridge',
        type: 'bridge',
        cityId: 'nyc',
        center: [40.7061, -73.9969],
        path: [
          [40.7126, -74.0048], // Manhattan entrance (City Hall)
          [40.7061, -73.9969], // Mid span
          [40.6998, -73.9895], // Brooklyn side (DUMBO / Brooklyn Heights)
        ],
        funFact: 'When opened in 1883, it was the world’s longest suspension bridge and P.T. Barnum led 21 elephants across to prove its structural integrity.',
        clues: [
          'Neo-Gothic limestone cable-stayed bridge spanning the East River.',
          'Connects Lower Manhattan City Hall with DUMBO and Brooklyn Heights.',
          'Features a beloved elevated wooden pedestrian promenade.',
        ],
        distractors: ['Manhattan Bridge', 'Williamsburg Bridge', 'Queensboro Bridge', 'Verrazzano-Narrows Bridge'],
        difficulty: 'easy',
      },
      {
        id: 'nyc_times_square',
        name: 'Times Square',
        type: 'square',
        cityId: 'nyc',
        center: [40.7580, -73.9855],
        radius: 120,
        funFact: 'Originally named Longacre Square, it was renamed in 1904 when The New York Times moved its headquarters to the One Times Square tower.',
        clues: [
          'Major commercial intersection illuminated by massive electronic billboards.',
          'Where Broadway intersects 7th Avenue between 42nd and 47th Streets.',
          'Famous for the annual New Year’s Eve crystal ball drop.',
        ],
        distractors: ['Herald Square', 'Union Square', 'Madison Square', 'Washington Square'],
        difficulty: 'easy',
      },
      {
        id: 'nyc_bowery',
        name: 'The Bowery',
        type: 'street',
        cityId: 'nyc',
        center: [40.7205, -73.9935],
        path: [
          [40.7135, -73.9975], // Chatham Square
          [40.7180, -73.9950], // Grand St
          [40.7230, -73.9920], // Houston St (former CBGB)
          [40.7280, -73.9900], // Cooper Square
        ],
        funFact: 'Derived from the Dutch word "bouwerij" (farm), linking Peter Stuyvesant’s 17th-century farmstead to New Amsterdam.',
        clues: [
          'Manhattan’s oldest thoroughfare, running through Lower East Side and East Village.',
          'Birthplace of American punk rock at the historic venue CBGB.',
          'Runs from Chatham Square up to Cooper Square.',
        ],
        distractors: ['Houston Street', 'Delancey Street', 'Canal Street', 'Orchard Street'],
        difficulty: 'medium',
      },
      {
        id: 'nyc_st_marks',
        name: 'St. Mark\'s Place',
        type: 'street',
        cityId: 'nyc',
        center: [40.7285, -73.9870],
        path: [
          [40.7295, -73.9900], // 3rd Ave
          [40.7285, -73.9870], // 2nd Ave
          [40.7275, -73.9840], // 1st Ave / Tompkins Square
        ],
        funFact: 'This three-block stretch of 8th Street has been a legendary cultural nexus for beatniks, hippies, punk rockers, and counterculture writers.',
        clues: [
          'Three-block East Village cultural haven stretching toward Tompkins Square Park.',
          'Immortalized on Led Zeppelin’s "Physical Graffiti" album cover.',
          'Former neighborhood home of W.H. Auden, Andy Warhol, and Allen Ginsberg.',
        ],
        distractors: ['Bleecker Street', 'MacDougal Street', 'Christopher Street', 'Rivington Street'],
        difficulty: 'hard',
      },
      {
        id: 'nyc_central_park_mall',
        name: 'The Mall (Central Park)',
        type: 'park',
        cityId: 'nyc',
        center: [40.7725, -73.9715],
        path: [
          [40.7695, -73.9730], // Literary Walk south
          [40.7725, -73.9715], // Central canopy
          [40.7742, -73.9705], // Bethesda Terrace
        ],
        funFact: 'The Mall is the only formal, straight promenade in Olmsted and Vaux’s original pastoral design for Central Park, lined with rare American elms.',
        clues: [
          'Grand quadruple row of canopy American elm trees inside Central Park.',
          'Leads directly into the iconic Bethesda Terrace and Fountain.',
          'Features "Literary Walk" statues of Shakespeare, Robert Burns, and Sir Walter Scott.',
        ],
        distractors: ['Sheep Meadow', 'The Ramble', 'Strawberry Fields', 'Great Lawn'],
        difficulty: 'medium',
      },
      {
        id: 'nyc_dumbo_water_st',
        name: 'Water Street (DUMBO)',
        type: 'street',
        cityId: 'nyc',
        center: [40.7032, -73.9897],
        path: [
          [40.7039, -73.9918], // Main St
          [40.7032, -73.9897], // Washington St intersection (photo spot)
          [40.7025, -73.9875], // Adams St
        ],
        funFact: 'The intersection with Washington Street framed by red brick warehouses is one of the most photographed vistas in the world, framing the Empire State Building inside a Manhattan Bridge arch.',
        clues: [
          'Cobblestone waterfront street in Brooklyn’s trendy DUMBO neighborhood.',
          'Offers the world-famous framed view of the Manhattan Bridge tower.',
          'Located just east of Brooklyn Bridge Park.',
        ],
        distractors: ['Front Street', 'Plymouth Street', 'Jay Street', 'Old Fulton Street'],
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'london',
    name: 'London',
    country: 'United Kingdom',
    countryCode: 'GB',
    center: [51.5074, -0.1278],
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 18,
    description: 'Winding historic streets, royal thoroughfares, and Thames crossings.',
    features: [
      {
        id: 'lon_abbey_road',
        name: 'Abbey Road',
        type: 'street',
        cityId: 'london',
        center: [51.5320, -0.1778],
        path: [
          [51.5360, -0.1810],
          [51.5320, -0.1778], // Famous Zebra Crossing
          [51.5280, -0.1740],
        ],
        funFact: 'The zebra crossing outside EMI Studios was designated a Grade II listed heritage site in 2010 for its cultural significance with The Beatles.',
        clues: [
          'Location of the most famous pedestrian zebra crossing on Earth.',
          'Situated in St John’s Wood, northwest London.',
          'The Beatles shot their August 1969 album cover here in 10 minutes.',
        ],
        distractors: ['Baker Street', 'Carnaby Street', 'Portobello Road', 'Kings Road'],
        difficulty: 'easy',
      },
      {
        id: 'lon_oxford_street',
        name: 'Oxford Street',
        type: 'street',
        cityId: 'london',
        center: [51.5148, -0.1450],
        path: [
          [51.5135, -0.1585], // Marble Arch
          [51.5145, -0.1480], // Bond St
          [51.5152, -0.1415], // Oxford Circus
          [51.5165, -0.1305], // Tottenham Court Rd
        ],
        funFact: 'Europe’s busiest shopping street with around 500,000 daily visitors, following the route of a Roman road known as Via Trinobantina.',
        clues: [
          'Major 1.2-mile shopping thoroughfare stretching from Marble Arch to Tottenham Court Road.',
          'Intersects Regent Street at the circular Oxford Circus.',
          'Home to flagship department stores including Selfridges.',
        ],
        distractors: ['Regent Street', 'Bond Street', 'Piccadilly', 'The Strand'],
        difficulty: 'easy',
      },
      {
        id: 'lon_baker_street',
        name: 'Baker Street',
        type: 'street',
        cityId: 'london',
        center: [51.5225, -0.1575],
        path: [
          [51.5160, -0.1530], // Oxford St corner
          [51.5225, -0.1575], // 221B & Sherlock Holmes Museum
          [51.5270, -0.1605], // Regent's Park entrance
        ],
        funFact: 'Fictional home of Sherlock Holmes at 221B; in Sir Arthur Conan Doyle’s time, street addresses in Baker Street did not go up to 221.',
        clues: [
          'Runs north towards Regent’s Park in Marylebone.',
          'Famed address 221B belongs to Arthur Conan Doyle’s consulting detective.',
          'Features a statue of Sherlock Holmes outside the Underground station.',
        ],
        distractors: ['Abbey Road', 'Marylebone High Street', 'Harley Street', 'Jermyn Street'],
        difficulty: 'easy',
      },
      {
        id: 'lon_the_strand',
        name: 'The Strand',
        type: 'street',
        cityId: 'london',
        center: [51.5115, -0.1200],
        path: [
          [51.5080, -0.1275], // Trafalgar Square
          [51.5105, -0.1225], // Savoy Hotel
          [51.5132, -0.1165], // Somerset House & Royal Courts of Justice
        ],
        funFact: 'Derived from Old English "strand", meaning shore or riverbank, as it historically ran along the shallow marshy banks of the River Thames.',
        clues: [
          'Connects Trafalgar Square to Fleet Street and the City of London.',
          'Flanked by the Savoy Hotel, Somerset House, and the Royal Courts of Justice.',
          'Historic corridor between the royal court at Westminster and commerce in the City.',
        ],
        distractors: ['Whitehall', 'Fleet Street', 'Piccadilly', 'Pall Mall'],
        difficulty: 'medium',
      },
      {
        id: 'lon_tower_bridge',
        name: 'Tower Bridge',
        type: 'bridge',
        cityId: 'london',
        center: [51.5055, -0.0754],
        path: [
          [51.5080, -0.0760], // Tower of London side
          [51.5055, -0.0754], // Mid-span bascule
          [51.5030, -0.0748], // Southwark side
        ],
        funFact: 'Its bascules open over 800 times a year to let tall ships pass; in 1952, a red double-decker bus had to jump a 3-foot gap when the bridge began opening prematurely!',
        clues: [
          'Victorian Gothic twin-tower bascule bridge over the Thames.',
          'Located immediately adjacent to the medieval Tower of London.',
          'Features high-level glass-floor walkways between the towers.',
        ],
        distractors: ['London Bridge', 'Millennium Bridge', 'Westminster Bridge', 'Blackfriars Bridge'],
        difficulty: 'easy',
      },
      {
        id: 'lon_carnaby_street',
        name: 'Carnaby Street',
        type: 'street',
        cityId: 'london',
        center: [51.5133, -0.1388],
        path: [
          [51.5118, -0.1382], // Beak St
          [51.5133, -0.1388], // Welcome to Carnaby arch
          [51.5148, -0.1394], // Great Marlborough St / Liberty
        ],
        funFact: 'Epicenter of the "Swinging Sixties" youth fashion revolution, frequented by The Rolling Stones, The Who, and Jimi Hendrix.',
        clues: [
          'Pedestrianized fashion avenue tucked behind Regent Street in Soho.',
          'Famed for its bright overhead neon greeting banners and swinging sixties boutique legacy.',
          'Steps from Liberty department store.',
        ],
        distractors: ['Kings Road', 'Brick Lane', 'Berwick Street', 'Old Compton Street'],
        difficulty: 'medium',
      },
      {
        id: 'lon_whitehall',
        name: 'Whitehall',
        type: 'street',
        cityId: 'london',
        center: [51.5035, -0.1265],
        path: [
          [51.5075, -0.1275], // Trafalgar Sq
          [51.5045, -0.1265], // Horse Guards Parade
          [51.5032, -0.1268], // Downing St entrance / Cenotaph
          [51.5008, -0.1260], // Parliament Sq
        ],
        funFact: 'Whitehall is often used as a metonym for British government administration, taking its name from the vast Palace of Whitehall destroyed by fire in 1698.',
        clues: [
          'Main administrative artery connecting Trafalgar Square to Parliament Square.',
          'Houses the entrance to 10 Downing Street and the Cenotaph war memorial.',
          'Site of Horse Guards and major ministerial headquarters.',
        ],
        distractors: ['The Mall', 'Constitution Hill', 'Victoria Street', 'Millbank'],
        difficulty: 'medium',
      },
      {
        id: 'lon_brick_lane',
        name: 'Brick Lane',
        type: 'street',
        cityId: 'london',
        center: [51.5208, -0.0715],
        path: [
          [51.5150, -0.0710], // Whitechapel High St
          [51.5208, -0.0715], // Truman Brewery
          [51.5260, -0.0725], // Bethnal Green Rd
        ],
        funFact: 'Got its name in the 15th century from brick and tile manufacturing using the local brick earth deposits along the lane.',
        clues: [
          'Vibrant East End street world-famous for curry houses, vintage markets, and street art.',
          'Anchored by the Old Truman Brewery complex in Shoreditch/Tower Hamlets.',
          'Home to iconic 24-hour salt beef bagel bakeries.',
        ],
        distractors: ['Columbia Road', 'Petticoat Lane', 'Commercial Street', 'Shoreditch High Street'],
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'paris',
    name: 'Paris',
    country: 'France',
    countryCode: 'FR',
    center: [48.8566, 2.3522],
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 18,
    description: 'Haussmann grand boulevards, Seine river quays, and iconic plazas.',
    features: [
      {
        id: 'par_champs_elysees',
        name: 'Avenue des Champs-Élysées',
        type: 'avenue',
        cityId: 'paris',
        center: [48.8698, 2.3075],
        path: [
          [48.8738, 2.2950], // Arc de Triomphe (Place Charles de Gaulle)
          [48.8698, 2.3075], // Midpoint / George V
          [48.8660, 2.3160], // Grand Palais / Petit Palais
          [48.8655, 2.3210], // Place de la Concorde
        ],
        funFact: 'Translated as the "Elysian Fields", the final resting place of heroic and virtuous souls in Greek mythology.',
        clues: [
          'Grand 1.2-mile avenue forming the core of the Axe Historique.',
          'Anchored at its western crest by the Arc de Triomphe.',
          'Traditional finishing sprint of the Tour de France cycling race.',
        ],
        distractors: ['Boulevard Saint-Germain', 'Avenue Montaigne', 'Rue de Rivoli', 'Boulevard Haussmann'],
        difficulty: 'easy',
      },
      {
        id: 'par_saint_germain',
        name: 'Boulevard Saint-Germain',
        type: 'boulevard',
        cityId: 'paris',
        center: [48.8530, 2.3330],
        path: [
          [48.8505, 2.3180], // Assemblée Nationale
          [48.8535, 2.3335], // Café de Flore & Les Deux Magots
          [48.8520, 2.3450], // Cluny / Sorbonne
          [48.8475, 2.3580], // Pont de Sully
        ],
        funFact: 'During the 1940s and 1950s, this boulevard’s cafés were the intellectual hub of existentialist philosophers Jean-Paul Sartre and Simone de Beauvoir.',
        clues: [
          'The premier boulevard of the Left Bank (Rive Gauche) in the 6th and 7th arrondissements.',
          'Famed for legendary literary cafés: Café de Flore and Les Deux Magots.',
          'Curving thoroughfare passing the medieval Église de Saint-Germain-des-Prés.',
        ],
        distractors: ['Boulevard Saint-Michel', 'Boulevard Montparnasse', 'Rue de Rennes', 'Rue de Rivoli'],
        difficulty: 'easy',
      },
      {
        id: 'par_rue_de_rivoli',
        name: 'Rue de Rivoli',
        type: 'street',
        cityId: 'paris',
        center: [48.8620, 2.3380],
        path: [
          [48.8655, 2.3215], // Place de la Concorde
          [48.8630, 2.3320], // Tuileries Garden arcades
          [48.8615, 2.3380], // Palais-Royal / Louvre Museum
          [48.8570, 2.3540], // Hôtel de Ville / Le Marais
        ],
        funFact: 'Commissioned by Napoleon Bonaparte in 1802 and named after his 1797 victory over the Austrian army at the Battle of Rivoli.',
        clues: [
          'Right Bank commercial street famous for its uniform neoclassical arcades.',
          'Bordered by the Tuileries Garden, Musée du Louvre, and Hôtel de Ville.',
          'Major east-west axis recently converted into a flagship cycling corridor.',
        ],
        distractors: ['Rue du Faubourg Saint-Honoré', 'Rue de la Paix', 'Boulevard des Capucines', 'Rue Saint-Denis'],
        difficulty: 'medium',
      },
      {
        id: 'par_pont_neuf',
        name: 'Pont Neuf',
        type: 'bridge',
        cityId: 'paris',
        center: [48.8570, 2.3414],
        path: [
          [48.8585, 2.3422], // Right Bank
          [48.8570, 2.3414], // Western tip of Île de la Cité (Square du Vert-Galant)
          [48.8552, 2.3398], // Left Bank
        ],
        funFact: 'Despite being called "New Bridge", it is paradoxically the oldest standing stone bridge across the Seine in Paris, completed in 1607 under King Henri IV.',
        clues: [
          'Oldest standing bridge in Paris, crossing the western tip of Île de la Cité.',
          'First stone bridge in Paris built without houses lining its sides.',
          'Features distinct semicircular bastions with stone grotesque mask carvings (mascarons).',
        ],
        distractors: ['Pont Alexandre III', 'Pont des Arts', 'Pont Saint-Michel', 'Pont de Bir-Hakeim'],
        difficulty: 'medium',
      },
      {
        id: 'par_montmartre_lepic',
        name: 'Rue Lepic (Montmartre)',
        type: 'street',
        cityId: 'paris',
        center: [48.8860, 2.3330],
        path: [
          [48.8828, 2.3325], // Moulin Rouge / Bd de Clichy
          [48.8860, 2.3330], // Café des 2 Moulins (Amélie)
          [48.8875, 2.3355], // Moulin de la Galette
          [48.8865, 2.3380], // Place Jean-Baptiste Clément
        ],
        funFact: 'Vincent van Gogh lived at 54 Rue Lepic with his brother Theo between 1886 and 1888, painting numerous views from his apartment window.',
        clues: [
          'Winding uphill cobblestone street climbing the Butte Montmartre.',
          'Passes the Café des 2 Moulins (featured in the film Amélie) and historic windmills.',
          'Begins at the foot of the hill near the Moulin Rouge.',
        ],
        distractors: ['Rue des Martyrs', 'Rue Norvins', 'Rue Gabrielle', 'Rue Cortot'],
        difficulty: 'hard',
      },
      {
        id: 'par_canal_saint_martin',
        name: 'Canal Saint-Martin',
        type: 'canal',
        cityId: 'paris',
        center: [48.8715, 2.3660],
        path: [
          [48.8530, 2.3685], // Port de l'Arsenal / Bastille
          [48.8680, 2.3680], // Place de la République east
          [48.8750, 2.3645], // Locks / Quai de Valmy
          [48.8835, 2.3705], // Bassin de la Villette
        ],
        funFact: 'Ordered by Napoleon in 1802 to bring fresh drinking water to cholera-plagued Parisians and funded by a new tax on wine.',
        clues: [
          'Picturesque 2.8-mile waterway with 9 locks and romantic cast-iron footbridges.',
          'Partially subterranean under Boulevard Richard-Lenoir before emerging in the 10th arrondissement.',
          'Beloved spot for waterside picnics along Quai de Valmy and Quai de Jemmapes.',
        ],
        distractors: ['Canal de l\'Ourcq', 'Canal Saint-Denis', 'Bassin de la Villette', 'Bassin de l\'Arsenal'],
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    country: 'Japan',
    countryCode: 'JP',
    center: [35.6762, 139.6503],
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 18,
    description: 'Dynamic neon thoroughfares, tranquil temple approaches, and iconic crossings.',
    features: [
      {
        id: 'tyo_shibuya_scramble',
        name: 'Shibuya Scramble Crossing',
        type: 'square',
        cityId: 'tokyo',
        center: [35.6595, 139.7005],
        radius: 80,
        funFact: 'During peak rush hour, up to 3,000 pedestrians cross simultaneously on a single green light, totaling over 2.4 million people per day.',
        clues: [
          'The world’s busiest pedestrian diagonal intersection.',
          'Located directly outside Shibuya Station’s Hachiko Exit.',
          'Surrounded by towering video billboards and the Starbucks Tsutaya building.',
        ],
        distractors: ['Sukiyabashi Crossing (Ginza)', 'Akihabara Crossing', 'Shinjuku East Exit Square', 'Roppongi Crossing'],
        difficulty: 'easy',
      },
      {
        id: 'tyo_takeshita_street',
        name: 'Takeshita Street (Harajuku)',
        type: 'street',
        cityId: 'tokyo',
        center: [35.6715, 139.7045],
        path: [
          [35.6702, 139.7028], // Harajuku Station Takeshita Exit
          [35.6715, 139.7045], // Midpoint crepe stands
          [35.6728, 139.7065], // Meiji-dori exit
        ],
        funFact: 'The spiritual birthplace of Japanese "kawaii" (cute) youth subcultures, famous for rainbow cotton candy, purikura photo booths, and Marion Crepes.',
        clues: [
          'Vibrant 400-meter pedestrian lane directly across from Harajuku Station.',
          'Global epicenter of Japanese kawaii pop culture and experimental street fashion.',
          'Leads eastward toward Meiji-dori avenue.',
        ],
        distractors: ['Omotesando', 'Cat Street', 'Center Gai (Shibuya)', 'Koenji Look Street'],
        difficulty: 'easy',
      },
      {
        id: 'tyo_omotesando',
        name: 'Omotesando Avenue',
        type: 'avenue',
        cityId: 'tokyo',
        center: [35.6665, 139.7090],
        path: [
          [35.6685, 139.7035], // Jingu-bashi / Meiji Jingu entrance
          [35.6665, 139.7090], // Omotesando Hills
          [35.6645, 139.7145], // Aoyama-dori intersection
        ],
        funFact: 'Originally built in 1920 as the formal grand frontal approach ("Omote-sando") road to the Meiji Shrine.',
        clues: [
          'Often dubbed "Tokyo’s Champs-Élysées", lined with majestic zelkova trees.',
          'Home to stunning contemporary architectural flagship boutiques and Omotesando Hills.',
          'Stretches from Harajuku to the fashionable Aoyama district.',
        ],
        distractors: ['Takeshita Street', 'Roppongi Dori', 'Aoyama Dori', 'Ginza Chuo Dori'],
        difficulty: 'medium',
      },
      {
        id: 'tyo_ginza_chuo_dori',
        name: 'Ginza Chuo-dori',
        type: 'avenue',
        cityId: 'tokyo',
        center: [35.6715, 139.7650],
        path: [
          [35.6675, 139.7605], // Shinbashi end
          [35.6715, 139.7650], // Ginza 4-chome / Wako clock tower
          [35.6755, 139.7695], // Kyobashi end
        ],
        funFact: 'On weekend afternoons, this entire 1-kilometer boulevard closes to vehicular traffic to become the "Pedestrian Paradise" (Hokosha Tengoku) with open-air umbrella tables.',
        clues: [
          'Tokyo’s ultra-prestigious luxury shopping boulevard.',
          'Anchored at 4-chome intersection by the iconic Hattori Seiko Wako clock tower.',
          'Transforms into a grand car-free pedestrian walkway on weekend afternoons.',
        ],
        distractors: ['Nihonbashi Street', 'Marunouchi Naka-dori', 'Hibiya Dori', 'Showa Dori'],
        difficulty: 'medium',
      },
      {
        id: 'tyo_nakamise_dori',
        name: 'Nakamise-dori (Asakusa)',
        type: 'street',
        cityId: 'tokyo',
        center: [35.7125, 139.7965],
        path: [
          [35.7110, 139.7963], // Kaminarimon Gate (Thunder Gate)
          [35.7125, 139.7965], // Nakamise market stalls
          [35.7142, 139.7967], // Hozomon Gate / Senso-ji Temple
        ],
        funFact: 'One of Japan’s oldest shopping streets, merchants were first granted permission to open stalls here in the early 18th century to serve temple pilgrims.',
        clues: [
          'Historic 250-meter temple approach lane paved with stone tiles.',
          'Stretches from the giant red lantern at Kaminarimon Gate to Senso-ji Temple.',
          'Lined with traditional stalls selling ningyo-yaki cakes, fans, and senbei rice crackers.',
        ],
        distractors: ['Kappabashi Street', 'Ameyoko Market Street', 'Omoide Yokocho', 'Yanaka Ginza'],
        difficulty: 'easy',
      },
      {
        id: 'tyo_akihabara_chuo_dori',
        name: 'Akihabara Chuo-dori',
        type: 'avenue',
        cityId: 'tokyo',
        center: [35.7015, 139.7715],
        path: [
          [35.6975, 139.7710], // Manseibashi bridge
          [35.7015, 139.7715], // Radio Kaikan / Electric Town
          [35.7060, 139.7720], // Suehirocho Station
        ],
        funFact: 'Originated after WWII as a black market for surplus radio components and vacuum tubes, transforming into the global capital of electronics, anime, and gaming.',
        clues: [
          'The neon-drenched central spine of Tokyo’s "Electric Town".',
          'Lined with multi-story manga emporiums, retro gaming arcades, and maid cafés.',
          'Passes beside Akihabara Station toward Suehirocho.',
        ],
        distractors: ['Kanda Jimbocho', 'Ochanomizu Dori', 'Shinjuku Yasukuni Dori', 'Ikebukuro Sunshine Dori'],
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'sf',
    name: 'San Francisco',
    country: 'United States',
    countryCode: 'US',
    center: [37.7749, -122.4194],
    defaultZoom: 13,
    minZoom: 11,
    maxZoom: 18,
    description: 'Steep hill climbs, crooked switchbacks, and Pacific coastline vistas.',
    features: [
      {
        id: 'sf_lombard_street',
        name: 'Lombard Street (Crooked Section)',
        type: 'street',
        cityId: 'sf',
        center: [37.8021, -122.4187],
        path: [
          [37.8020, -122.4198], // Hyde St / Cable car top
          [37.8021, -122.4187], // 8 tight switchbacks & hydrangeas
          [37.8022, -122.4177], // Leavenworth St bottom
        ],
        funFact: 'The eight hairpin turns were built in 1922 to reduce the hill’s natural 27% grade, which was too steep for most early automobiles to ascend.',
        clues: [
          'Known as the "Crookedest Street in the World".',
          'One-block red-brick section paved with eight tight hairpin switchbacks.',
          'Perched on Russian Hill with Powell-Hyde cable cars running past the top.',
        ],
        distractors: ['Filbert Street', 'Vermont Street', 'California Street', 'Columbus Avenue'],
        difficulty: 'easy',
      },
      {
        id: 'sf_market_street',
        name: 'Market Street',
        type: 'avenue',
        cityId: 'sf',
        center: [37.7845, -122.4070],
        path: [
          [37.7955, -122.3935], // Ferry Building & Embarcadero
          [37.7880, -122.4015], // Financial District / Montgomery
          [37.7845, -122.4070], // Powell St Cable Car turntable
          [37.7780, -122.4140], // Civic Center / City Hall
          [37.7635, -122.4345], // Castro & Twin Peaks base
        ],
        funFact: 'Laid out in 1847 by surveyor Jasper O’Farrell, it deliberately intersects with the north-side grid at an awkward angle, creating iconic triangular "flat-iron" intersections.',
        clues: [
          'San Francisco’s primary 3-mile diagonal transit and commercial spine.',
          'Originates at the waterfront Ferry Building and ends at Twin Peaks in The Castro.',
          'Historic F-Market vintage streetcars run along its center tracks.',
        ],
        distractors: ['Mission Street', 'Geary Boulevard', 'Van Ness Avenue', 'Howard Street'],
        difficulty: 'easy',
      },
      {
        id: 'sf_haight_street',
        name: 'Haight Street',
        type: 'street',
        cityId: 'sf',
        center: [37.7698, -122.4465],
        path: [
          [37.7712, -122.4335], // Lower Haight (Divisadero)
          [37.7698, -122.4465], // Haight-Ashbury intersection
          [37.7690, -122.4535], // Golden Gate Park panhandle entrance
        ],
        funFact: 'The epicenter of the 1967 "Summer of Love", when as many as 100,000 hippies and artists converged on the neighborhood.',
        clues: [
          'Epicenter of the 1960s counterculture movement at its intersection with Ashbury.',
          'Lined with Victorian row houses, vintage vinyl shops, and psychedelic murals.',
          'Terminates at the eastern entrance to Golden Gate Park.',
        ],
        distractors: ['Castro Street', 'Valencia Street', 'Hayes Street', 'Fillmore Street'],
        difficulty: 'easy',
      },
      {
        id: 'sf_embarcadero',
        name: 'The Embarcadero',
        type: 'boulevard',
        cityId: 'sf',
        center: [37.7995, -122.3980],
        path: [
          [37.7785, -122.3890], // Oracle Park / China Basin
          [37.7955, -122.3935], // Ferry Building
          [37.8060, -122.4035], // Pier 39 / Fisherman\'s Wharf
          [37.8085, -122.4170], // Aquatic Park
        ],
        funFact: 'Its name comes from the Spanish verb "embarcar" (to embark). The double-decker freeway above it was destroyed in the 1989 Loma Prieta earthquake and rebuilt into this scenic boulevard.',
        clues: [
          'Sweeping eastern waterfront roadway along San Francisco Bay.',
          'Connects Oracle Park in the south past the Ferry Building up to Fisherman’s Wharf.',
          'Offers unobstructed views of the Bay Bridge and historic maritime piers.',
        ],
        distractors: ['Marina Boulevard', 'Columbus Avenue', 'Great Highway', 'King Street'],
        difficulty: 'medium',
      },
      {
        id: 'sf_golden_gate_bridge',
        name: 'Golden Gate Bridge',
        type: 'bridge',
        cityId: 'sf',
        center: [37.8199, -122.4783],
        path: [
          [37.8075, -122.4750], // Presidio toll plaza / Welcome Center
          [37.8199, -122.4783], // Mid-span / Marin Headlands view
          [37.8325, -122.4800], // Vista Point (Marin County)
        ],
        funFact: 'Its signature color is "International Orange", chosen by consulting architect Irving Morrow because it provides high visibility in dense San Francisco fog.',
        clues: [
          'Art Deco suspension bridge spanning the strait between SF and Marin County.',
          'Painted in iconic "International Orange" with 746-foot tall towers.',
          'One of the internationally recognized wonders of modern civil engineering.',
        ],
        distractors: ['San Francisco-Oakland Bay Bridge', 'Richmond-San Rafael Bridge', 'San Mateo Bridge', 'Dumbarton Bridge'],
        difficulty: 'easy',
      },
      {
        id: 'sf_grant_avenue',
        name: 'Grant Avenue (Chinatown)',
        type: 'street',
        cityId: 'sf',
        center: [37.7925, -122.4060],
        path: [
          [37.7885, -122.4050], // Dragon Gate at Bush St
          [37.7925, -122.4060], // Heart of Chinatown / California St Cable car
          [37.7985, -122.4075], // Broadway / North Beach border
        ],
        funFact: 'The oldest street in San Francisco, originally laid out in 1834 as Calle de la Fundación before California joined the United States.',
        clues: [
          'Chinatown’s principal commercial corridor entered through the ornamental Dragon Gate.',
          'Decorated with ornate dragon streetlamps, red lantern canopies, and herbalist apothecary shops.',
          'Crosses California Street before flowing into North Beach.',
        ],
        distractors: ['Stockton Street', 'Kearny Street', 'Jackson Street', 'Montgomery Street'],
        difficulty: 'medium',
      },
    ],
  },
  {
    id: 'rome',
    name: 'Rome',
    country: 'Italy',
    countryCode: 'IT',
    center: [41.9028, 12.4964],
    defaultZoom: 14,
    minZoom: 12,
    maxZoom: 18,
    description: 'Ancient arteries, cobblestone piazzas, and Baroque monumental squares.',
    features: [
      {
        id: 'rom_via_del_corso',
        name: 'Via del Corso',
        type: 'street',
        cityId: 'rome',
        center: [41.9035, 12.4795],
        path: [
          [41.9105, 12.4765], // Piazza del Popolo
          [41.9035, 12.4795], // Piazza Colonna / Marcus Aurelius Column
          [41.8965, 12.4820], // Piazza Venezia / Altare della Patria
        ],
        funFact: 'In the Middle Ages and Renaissance, riderless Barbary horse races were held along this straight street during Roman Carnival.',
        clues: [
          'Straight 1.5-km historic spine connecting Piazza del Popolo to Piazza Venezia.',
          'Rome’s busiest central shopping boulevard through the Centro Storico.',
          'Passes beside Piazza Colonna and the Italian Parliament.',
        ],
        distractors: ['Via Nazionale', 'Via del Babuino', 'Via dei Condotti', 'Corso Vittorio Emanuele II'],
        difficulty: 'easy',
      },
      {
        id: 'rom_piazza_navona',
        name: 'Piazza Navona',
        type: 'square',
        cityId: 'rome',
        center: [41.8992, 12.4731],
        radius: 75,
        funFact: 'Its elongated oval shape preserves the exact footprint of Emperor Domitian’s 1st-century AD athletic stadium (Circus Agonalis).',
        clues: [
          'Elongated Baroque piazza adorned with three monumental fountains.',
          'Features Bernini’s famous Fontana dei Fiumi (Fountain of the Four Rivers) and Sant’Agnese in Agone church.',
          'Built on the site of ancient athletic games in the Campus Martius.',
        ],
        distractors: ['Piazza di Spagna', 'Piazza del Popolo', 'Campo de\' Fiori', 'Piazza Venezia'],
        difficulty: 'easy',
      },
      {
        id: 'rom_spanish_steps',
        name: 'Spanish Steps & Piazza di Spagna',
        type: 'square',
        cityId: 'rome',
        center: [41.9058, 12.4823],
        radius: 60,
        funFact: 'The monumental stairway of 135 steps was funded by a French diplomat’s bequest in 1723 to link the Spanish Embassy to the Holy See with the Trinità dei Monti church.',
        clues: [
          'Famous 135-step Baroque stairway rising from the Barcaccia fountain.',
          'Connects the Piazza di Spagna at the base with the Trinità dei Monti church above.',
          'Anchors the luxury shopping avenue Via dei Condotti.',
        ],
        distractors: ['Piazza Navona', 'Piazza del Popolo', 'Piazza Farnese', 'Quirinale Square'],
        difficulty: 'easy',
      },
      {
        id: 'rom_fori_imperiali',
        name: 'Via dei Fori Imperiali',
        type: 'avenue',
        cityId: 'rome',
        center: [41.8925, 12.4880],
        path: [
          [41.8955, 12.4835], // Piazza Venezia
          [41.8925, 12.4880], // Forum of Augustus / Trajan's Forum
          [41.8902, 12.4920], // Colosseum
        ],
        funFact: 'Constructed in 1932 to create a triumphant vista connecting Mussolini’s headquarters at Palazzo Venezia directly to the Colosseum.',
        clues: [
          'Grand boulevard directly linking Piazza Venezia to the Colosseum.',
          'Flanked on both sides by the ruins of the Roman Forum and Imperial Fora.',
          'Passes Trajan’s Column and the Temple of Peace.',
        ],
        distractors: ['Via Appia Antica', 'Via Sacra', 'Via Nazionale', 'Via Giulia'],
        difficulty: 'medium',
      },
      {
        id: 'rom_campo_de_fiori',
        name: 'Campo de\' Fiori',
        type: 'square',
        cityId: 'rome',
        center: [41.8955, 12.4722],
        radius: 50,
        funFact: 'Translated as "Field of Flowers" because it was an open meadow in the Middle Ages; it is the only major historic piazza in Rome without a church.',
        clues: [
          'Lively rectangular piazza hosting a bustling morning fruit/flower market.',
          'Dominated in the center by the brooding bronze statue of philosopher Giordano Bruno.',
          'Transforms into a vibrant nightlife square surrounded by trattorias.',
        ],
        distractors: ['Piazza Navona', 'Piazza Farnese', 'Piazza Mattei', 'Piazza Trilussa'],
        difficulty: 'medium',
      },
      {
        id: 'rom_via_appia_antica',
        name: 'Via Appia Antica (Appian Way)',
        type: 'street',
        cityId: 'rome',
        center: [41.8540, 12.5200],
        path: [
          [41.8730, 12.5020], // Porta San Sebastiano
          [41.8590, 12.5140], // Catacombs of Saint Callixtus
          [41.8520, 12.5220], // Tomb of Caecilia Metella
          [41.8410, 12.5350], // Ancient basalt paving stones section
        ],
        funFact: 'Known as the "Regina Viarum" (Queen of Roads), it was begun in 312 BC by Appius Claudius Caecus to connect Rome to Brindisi on the Adriatic coast.',
        clues: [
          'One of the earliest and most strategically crucial military Roman roads.',
          'Preserves original massive volcanic basalt paving stones and ancient pine trees.',
          'Flanked by ancient Roman catacombs and the Tomb of Caecilia Metella.',
        ],
        distractors: ['Via Flaminia', 'Via Salaria', 'Via Aurelia', 'Via Latina'],
        difficulty: 'hard',
      },
    ],
  },
  {
    id: 'amsterdam',
    name: 'Amsterdam',
    country: 'Netherlands',
    countryCode: 'NL',
    center: [52.3676, 4.8952],
    defaultZoom: 14,
    minZoom: 12,
    maxZoom: 18,
    description: 'UNESCO World Heritage 17th-century canal ring, historic bridges, and vibrant squares.',
    features: [
      {
        id: 'ams_herengracht',
        name: 'Herengracht (Gentlemen\'s Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3685, 4.8872],
        path: [
          [52.3792, 4.8906], // Brouwersgracht junction
          [52.3774, 4.8893], // Blauwburgwal bridge
          [52.3756, 4.8882], // Leliegracht
          [52.3738, 4.8875], // Raadhuisstraat crossing
          [52.3718, 4.8870], // Gasthuismolensteeg
          [52.3700, 4.8869], // Wolvenstraat
          [52.3680, 4.8874], // Huidenstraat / Canal Museum
          [52.3664, 4.8885], // Leidsestraat intersection (Koningsplein)
          [52.3648, 4.8910], // Gouden Bocht (Golden Bend)
          [52.3642, 4.8942], // Vijzelstraat crossing
          [52.3640, 4.8970], // Reguliersgracht intersection
          [52.3642, 4.9000], // Thorbeckeplein / Utrechtsestraat
          [52.3658, 4.9038], // Amstel confluence
        ],
        funFact: 'The "Gouden Bocht" (Golden Bend) along this canal is where the wealthiest merchants, bankers, and governors built monumental double-width mansions during the Dutch Golden Age.',
        clues: [
          'The innermost of the three primary concentric ring canals.',
          'Home to the ultra-prestigious "Gouden Bocht" (Golden Bend) double-width mansions.',
          'Named after the "Heeren" (gentlemen regents) who governed the city of Amsterdam.',
        ],
        distractors: ['Keizersgracht', 'Prinsengracht', 'Singel', 'Groenburgwal'],
        difficulty: 'easy',
      },
      {
        id: 'ams_keizersgracht',
        name: 'Keizersgracht (Emperor\'s Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3700, 4.8840],
        path: [
          [52.3804, 4.8872], // Brouwersgracht junction
          [52.3768, 4.8853], // Leliegracht
          [52.3746, 4.8845], // Westermarkt / Raadhuisstraat
          [52.3725, 4.8840], // Reestraat / Hartenstraat
          [52.3700, 4.8838], // Berenstraat / Felix Meritis
          [52.3678, 4.8842], // Runstraat
          [52.3656, 4.8856], // Leidsestraat bridge
          [52.3638, 4.8882], // Spiegelgracht vista
          [52.3628, 4.8918], // Vijzelstraat bridge
          [52.3624, 4.8955], // Reguliersgracht (Seven Bridges)
          [52.3626, 4.8992], // Utrechtsestraat
          [52.3638, 4.9042], // Amstel confluence
        ],
        funFact: 'Named in honor of Emperor Maximilian I of the Holy Roman Empire, it is the widest of Amsterdam’s main central belt canals (31 meters wide).',
        clues: [
          'The middle and widest canal among the three main canal belt rings.',
          'Named after Holy Roman Emperor Maximilian I.',
          'Famous for the Homomonument and intersection with Reguliersgracht (view of seven arched bridges).',
        ],
        distractors: ['Prinsengracht', 'Herengracht', 'Singel', 'Kloveniersburgwal'],
        difficulty: 'easy',
      },
      {
        id: 'ams_prinsengracht',
        name: 'Prinsengracht (Prince\'s Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3715, 4.8808],
        path: [
          [52.3816, 4.8837], // Brouwersgracht junction (Noordermarkt)
          [52.3795, 4.8824], // Noordermarkt
          [52.3752, 4.8812], // Anne Frank House / Westerkerk
          [52.3735, 4.8808], // Rozengracht bridge
          [52.3700, 4.8805], // Elandsgracht / Jordaan
          [52.3672, 4.8808], // Looiersgracht
          [52.3642, 4.8825], // Leidsestraat bridge
          [52.3622, 4.8868], // Spiegelgracht
          [52.3608, 4.8912], // Vijzelstraat
          [52.3604, 4.8962], // Reguliersgracht
          [52.3608, 4.9008], // Utrechtsestraat
          [52.3618, 4.9056], // Confluence at Amstel river
        ],
        funFact: 'Named after the Prince of Orange, it is the fourth and outermost of Amsterdam’s three major concentric canal ring waterways.',
        clues: [
          'The outermost of the three grand 17th-century concentric canal belt rings.',
          'Home to the Anne Frank House and the towering spire of Westerkerk.',
          'Borders the historic Jordaan neighborhood to the east.',
        ],
        distractors: ['Keizersgracht', 'Herengracht', 'Singel', 'Brouwersgracht'],
        difficulty: 'easy',
      },
      {
        id: 'ams_singel',
        name: 'Singel',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3710, 4.8905],
        path: [
          [52.3780, 4.8943], // Haarlemmersluis / Stromarkt
          [52.3760, 4.8932], // Korsjespoortsteeg
          [52.3738, 4.8915], // Torensluis bridge (Amsterdam's widest bridge)
          [52.3725, 4.8905], // Raadhuisstraat
          [52.3690, 4.8895], // Spui area
          [52.3675, 4.8900], // Heiligeweg
          [52.3668, 4.8920], // Bloemenmarkt (Floating Flower Market)
          [52.3670, 4.8948], // Muntplein / Munttoren
        ],
        funFact: 'Served as Amsterdam’s outer defensive moat in the Middle Ages until 1585, when the city expanded outward; today it hosts the world\'s only floating flower market (Bloemenmarkt).',
        clues: [
          'Medieval boundary canal that encircled the historic city core until 1585.',
          'Hosts the world-famous Bloemenmarkt (floating flower market) near Muntplein.',
          'Crossed by the Torensluis, Amsterdam’s oldest surviving and widest historic bridge.',
        ],
        distractors: ['Singelgracht', 'Herengracht', 'Prinsengracht', 'Keizersgracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_brouwersgracht',
        name: 'Brouwersgracht (Brewer\'s Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3808, 4.8858],
        path: [
          [52.3780, 4.8943], // Haarlemmersluis / Singel
          [52.3792, 4.8906], // Herengracht bridge
          [52.3804, 4.8872], // Keizersgracht bridge
          [52.3816, 4.8837], // Prinsengracht bridge / Noordermarkt
          [52.3826, 4.8805], // Driehoekstraat / Palmgracht
          [52.3837, 4.8770], // Singelgracht confluence (Bullebak)
        ],
        funFact: 'Repeatedly voted the most beautiful street and canal in Amsterdam by readers of the national newspaper Het Parool, originally lined with beer breweries and leather tanneries.',
        clues: [
          'Connects the northern ends of Singel, Herengracht, Keizersgracht, and Prinsengracht.',
          'Named after the 16th-century beer breweries and grain warehouses that once operated here.',
          'Consistently voted the most picturesque canal in Amsterdam.',
        ],
        distractors: ['Lijnbaansgracht', 'Rozengracht', 'Egelantiersgracht', 'Bloemgracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_amstel_river',
        name: 'Amstel River',
        type: 'water',
        cityId: 'amsterdam',
        center: [52.3638, 4.9025],
        path: [
          [52.3695, 4.8988], // Halvemaansbrug
          [52.3672, 4.9010], // Blauwbrug / Stopera
          [52.3655, 4.9018], // Hermitage Amsterdam / H\'ART
          [52.3638, 4.9025], // Magere Brug (Skinny Bridge)
          [52.3605, 4.9045], // Koninklijk Theater Carré / Hogesluis
          [52.3550, 4.9070], // Torontobrug / Ceintuurbaan
          [52.3480, 4.9095], // Berlagebrug / Amstel Station
        ],
        funFact: 'The city of Amsterdam literally takes its name from this river: originally settled as "Amstelredamme" (a dam built in the river Amstel) in the late 12th century.',
        clues: [
          'The primary river flowing through the city that gave Amsterdam its historic name.',
          'Spanned by the famous wooden double-drawbridge "Magere Brug" (Skinny Bridge).',
          'Flanked by the Hermitage Amsterdam museum and Koninklijk Theater Carré.',
        ],
        distractors: ['IJ River', 'Vecht River', 'Zaan River', 'Spaarne'],
        difficulty: 'easy',
      },
      {
        id: 'ams_reguliersgracht',
        name: 'Reguliersgracht (Seven Bridges Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3628, 4.8962],
        path: [
          [52.3654, 4.8950], // Herengracht junction
          [52.3638, 4.8958], // Keizersgracht junction
          [52.3618, 4.8966], // Prinsengracht junction
          [52.3602, 4.8974], // Lijnbaansgracht / Weteringschans
        ],
        funFact: 'Standing at the intersection with Keizersgracht, you can gaze through the arches of seven consecutive lit brick canal bridges in a straight line.',
        clues: [
          'Famous transverse canal cutting across Herengracht, Keizersgracht, and Prinsengracht.',
          'Renowned for the view of seven illuminated arched bridges in a single vantage point.',
          'Named after the 14th-century monastery of the Regular Canons of Saint Augustine.',
        ],
        distractors: ['Spiegelgracht', 'Kloveniersburgwal', 'Groenburgwal', 'Singel'],
        difficulty: 'medium',
      },
      {
        id: 'ams_bloemgracht',
        name: 'Bloemgracht (Flower Canal)',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3738, 4.8760],
        path: [
          [52.3745, 4.8805], // Prinsengracht / Westerkerk west
          [52.3738, 4.8760], // Heart of Jordaan
          [52.3732, 4.8725], // Lijnbaansgracht junction
        ],
        funFact: 'Nicknamed the "Herengracht of the Jordaan" because wealthier merchants settled along this picturesque canal, featuring three famous stepped-gable houses from 1642.',
        clues: [
          'Known as the "Lord\'s Canal of the Jordaan" due to its ornate 17th-century merchant houses.',
          'Connects the Prinsengracht directly west toward the Lijnbaansgracht.',
          'Features three famous twin stepped-gable facades representing Faith, Hope, and Love.',
        ],
        distractors: ['Egelantiersgracht', 'Rozengracht', 'Lauriergracht', 'Brouwersgracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_oudezijds_voorburgwal',
        name: 'Oudezijds Voorburgwal',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3725, 4.8970],
        path: [
          [52.3768, 4.9004], // Zeedijk / Open Havenfront
          [52.3748, 4.8988], // Oude Kerk
          [52.3725, 4.8970], // Damstraat crossing
          [52.3705, 4.8955], // Oudemanhuispoort
          [52.3688, 4.8948], // Grimburgwal junction
        ],
        funFact: 'One of the oldest canals in Amsterdam, dug in 1385; home to the Oude Kerk (Amsterdam\'s oldest building) and the hidden canal attic church Museum Ons\' Lieve Heer op Solder.',
        clues: [
          'Medieval canal in the historic center flanking the Oude Kerk (Old Church).',
          'Home to the famous clandestine attic Catholic church museum.',
          'Connects the Zeedijk in the north down to the Grimburgwal.',
        ],
        distractors: ['Oudezijds Achterburgwal', 'Kloveniersburgwal', 'Nieuwezijds Voorburgwal', 'Singel'],
        difficulty: 'medium',
      },
      {
        id: 'ams_oudezijds_achterburgwal',
        name: 'Oudezijds Achterburgwal',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3720, 4.8982],
        path: [
          [52.3762, 4.9015], // Stormsteeg / Chinatown
          [52.3742, 4.9000], // Hash Marihuana & Hemp Museum
          [52.3720, 4.8982], // Wallen heart
          [52.3698, 4.8968], // University of Amsterdam campus
          [52.3682, 4.8960], // Grimburgwal junction
        ],
        funFact: 'Dug in 1367 as Amsterdam\'s eastern defensive moat; today houses parts of the University of Amsterdam and historic bookstalls at Oudemanhuispoort.',
        clues: [
          'Parallel medieval canal located east of Oudezijds Voorburgwal.',
          'Crossed by the historic Oudemanhuispoort covered passage.',
          'Originates near the Zeedijk and terminates at the Grimburgwal.',
        ],
        distractors: ['Oudezijds Voorburgwal', 'Kloveniersburgwal', 'Geldersekade', 'Singel'],
        difficulty: 'medium',
      },
      {
        id: 'ams_kloveniersburgwal',
        name: 'Kloveniersburgwal',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3698, 4.8985],
        path: [
          [52.3735, 4.9010], // Nieuwmarkt / Waag
          [52.3718, 4.8998], // Bushuis
          [52.3698, 4.8985], // Trippenhuis (KNAW)
          [52.3682, 4.8972], // Doelen Hotel
          [52.3670, 4.8960], // Amstel confluence / Halvemaansbrug
        ],
        funFact: 'Named after the "Kloveniers", the 16th-century civic guards equipped with harquebuses (early muskets), who practiced their shooting along this canal embankment.',
        clues: [
          'Historic 15th-century defense canal running from Nieuwmarkt to the Amstel.',
          'Home to the neoclassical Trippenhuis (Royal Netherlands Academy of Arts and Sciences).',
          'Named after the guild of early firearm-bearing militia guards.',
        ],
        distractors: ['Oudezijds Voorburgwal', 'Groenburgwal', 'Singel', 'Herengracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_spiegelgracht',
        name: 'Spiegelgracht',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3610, 4.8860],
        path: [
          [52.3625, 4.8872], // Prinsengracht junction
          [52.3610, 4.8860], // Antique and art galleries
          [52.3598, 4.8850], // Lijnbaansgracht / Rijksmuseum view
        ],
        funFact: 'Short, picturesque canal famous as the centerpiece of Amsterdam’s prestigious Spiegelkwartier art and antique gallery district.',
        clues: [
          'Short canal providing a direct photographic vista toward the Rijksmuseum towers.',
          'Heart of the Spiegelkwartier art, antique, and jewelry gallery district.',
          'Extends south from the Prinsengracht to the Lijnbaansgracht.',
        ],
        distractors: ['Reguliersgracht', 'Bloemgracht', 'Leidsegracht', 'Keizersgracht'],
        difficulty: 'hard',
      },
      {
        id: 'ams_magere_brug',
        name: 'Magere Brug (Skinny Bridge)',
        type: 'bridge',
        cityId: 'amsterdam',
        center: [52.3638, 4.9025],
        path: [
          [52.3639, 4.9018], // West bank (Kerkstraat)
          [52.3638, 4.9025], // Wooden double-leaf center
          [52.3637, 4.9032], // East bank (Nieuwe Kerkstraat)
        ],
        funFact: 'Legend says it was built by two wealthy sisters (the "Mager sisters") who lived on opposite sides of the Amstel so they could visit each other daily.',
        clues: [
          'Famous traditional white-painted Dutch double-leaf wooden drawbridge across the Amstel.',
          'Connects Kerkstraat on the west bank with Nieuwe Kerkstraat on the east bank.',
          'Illuminated by over 1,200 fairy lights every evening.',
        ],
        distractors: ['Blauwbrug', 'Torensluis', 'Staalmeestersbrug', 'Python Bridge'],
        difficulty: 'easy',
      },
      {
        id: 'ams_blauwbrug',
        name: 'Blauwbrug (Blue Bridge)',
        type: 'bridge',
        cityId: 'amsterdam',
        center: [52.3672, 4.9010],
        path: [
          [52.3670, 4.9000], // Waterlooplein / Stopera side
          [52.3672, 4.9010], // Bridge deck
          [52.3675, 4.9020], // Amstelstraat side
        ],
        funFact: 'Inspired by the Pont Alexandre III in Paris, adorned with sculpted ships (koggeschepen) and the Imperial Crown of Austria atop ornate cast-iron lampposts.',
        clues: [
          'Historic 19th-century stone bridge spanning the Amstel near the Stopera (City Hall).',
          'Heavily inspired by Paris’s Seine river bridges with imperial crowns and ship crests.',
          'Connects the Rembrandtplein area with Waterlooplein.',
        ],
        distractors: ['Magere Brug', 'Torensluis', 'Staalmeestersbrug', 'Hoge Sluis'],
        difficulty: 'medium',
      },
      {
        id: 'ams_dam_square',
        name: 'Dam Square',
        type: 'square',
        cityId: 'amsterdam',
        center: [52.3730, 4.8936],
        radius: 75,
        funFact: 'Created in the 13th century when a dam was constructed around the river Amstel to prevent the Zuiderzee sea from flooding the village.',
        clues: [
          'The historical and geographical heart of Amsterdam.',
          'Home to the Royal Palace (Koninklijk Paleis), Nieuwe Kerk, and the National Monument.',
          'Located at the northern terminus of the bustling Kalverstraat.',
        ],
        distractors: ['Leidseplein', 'Rembrandtplein', 'Museumplein', 'Waterlooplein'],
        difficulty: 'easy',
      },
      {
        id: 'ams_vondelpark',
        name: 'Vondelpark',
        type: 'park',
        cityId: 'amsterdam',
        center: [52.3580, 4.8685],
        path: [
          [52.3620, 4.8800], // Stadhouderskade / Leidseplein entrance
          [52.3585, 4.8700], // Open air theatre & rose garden
          [52.3550, 4.8550], // Amstelveenseweg western end
        ],
        funFact: 'Welcomes over 10 million visitors annually and was named in honor of the 17th-century Dutch playwright and poet Joost van den Vondel.',
        clues: [
          'Amsterdam’s most famous and visited public English landscape urban park (120 acres).',
          'Features an open-air theatre, rose garden, and tranquil winding waterways.',
          'Extends west from the Museum Quarter and Leidseplein toward Amstelveenseweg.',
        ],
        distractors: ['Sarphatipark', 'Westerpark', 'Oosterpark', 'Amsterdamse Bos'],
        difficulty: 'easy',
      },
      {
        id: 'ams_museumplein',
        name: 'Museumplein (Museum Square)',
        type: 'square',
        cityId: 'amsterdam',
        center: [52.3582, 4.8812],
        radius: 90,
        funFact: 'Constructed on the site of a former 19th-century candle factory, it is framed by three of the world’s most prestigious art museums and the Royal Concertgebouw.',
        clues: [
          'Grand public lawn in the Museumkwartier.',
          'Surrounded by the Rijksmuseum, Van Gogh Museum, Stedelijk Museum, and Concertgebouw.',
          'Features a large reflecting pool that transforms into an ice-skating rink in winter.',
        ],
        distractors: ['Dam Square', 'Rembrandtplein', 'Leidseplein', 'Spui'],
        difficulty: 'easy',
      },
      {
        id: 'ams_rijksmuseum',
        name: 'Rijksmuseum',
        type: 'landmark',
        cityId: 'amsterdam',
        center: [52.3600, 4.8852],
        funFact: 'Designed by Pierre Cuypers and opened in 1885, it is the only museum in the world with an open public bicycle underpass cutting directly through its building.',
        clues: [
          'Dutch national museum dedicated to art and history.',
          'Famous for Rembrandt’s The Night Watch and Vermeer’s The Milkmaid.',
          'Features a grand bicycle passageway running straight through its central atrium.',
        ],
        distractors: ['Van Gogh Museum', 'Stedelijk Museum', 'Anne Frank House', 'Rembrandt House'],
        difficulty: 'easy',
      },
      {
        id: 'ams_anne_frank_house',
        name: 'Anne Frank House',
        type: 'landmark',
        cityId: 'amsterdam',
        center: [52.3752, 4.8840],
        funFact: 'Preserves the secret annex where Anne Frank and seven others hid from Nazi persecution between 1942 and 1944 on the Prinsengracht.',
        clues: [
          'Historic biographical museum situated on the Prinsengracht.',
          'Commemorates Jewish wartime diarist Anne Frank and the Secret Annex.',
          'Located just footsteps from the Westerkerk tower.',
        ],
        distractors: ['Royal Palace', 'Rijksmuseum', 'Nemo Science Museum', 'Rembrandt House'],
        difficulty: 'easy',
      },
      {
        id: 'ams_kalverstraat',
        name: 'Kalverstraat',
        type: 'street',
        cityId: 'amsterdam',
        center: [52.3690, 4.8918],
        path: [
          [52.3725, 4.8930], // Dam Square start
          [52.3690, 4.8918], // Spui intersection
          [52.3668, 4.8915], // Muntplein end
        ],
        funFact: 'Named after the 15th-century calves market (kalvermarkt) held here; it is the most expensive street on the Dutch Monopoly board.',
        clues: [
          'Amsterdam’s premier pedestrian shopping street running north-south.',
          'Runs from Dam Square directly to Muntplein.',
          'The most valuable property on the Dutch Monopoly board.',
        ],
        distractors: ['Leidsestraat', 'Damrak', 'Rokin', 'Haarlemmerstraat'],
        difficulty: 'easy',
      },
      {
        id: 'ams_damrak',
        name: 'Damrak',
        type: 'avenue',
        cityId: 'amsterdam',
        center: [52.3765, 4.8970],
        path: [
          [52.3785, 4.8995], // Centraal Station
          [52.3755, 4.8965], // Beurs van Berlage
          [52.3735, 4.8935], // Dam Square
        ],
        funFact: 'Originally the mouth of the Amstel River where ships docked directly in front of the town square before the canal basin was partially filled in 1883.',
        clues: [
          'Major grand boulevard connecting Centraal Station directly to Dam Square.',
          'Lined with canal cruise tour docks and the famous gingerbread-style canal houses.',
          'Home to the historic Beurs van Berlage (commodity exchange building).',
        ],
        distractors: ['Rokin', 'Kalverstraat', 'Nieuwendijk', 'Prins Hendrikkade'],
        difficulty: 'easy',
      },
      {
        id: 'ams_leidsestraat',
        name: 'Leidsestraat',
        type: 'street',
        cityId: 'amsterdam',
        center: [52.3645, 4.8860],
        path: [
          [52.3670, 4.8890], // Koningsplein
          [52.3645, 4.8860], // Keizersgracht bridge
          [52.3630, 4.8830], // Leidseplein
        ],
        funFact: 'Originally part of the main 17th-century stagecoach route from Amsterdam to the university city of Leiden.',
        clues: [
          'High-energy shopping and transit street connecting Koningsplein to Leidseplein.',
          'Crosses all three major canals: Herengracht, Keizersgracht, and Prinsengracht.',
          'Carries busy tram routes 2 and 12 across stepped canal bridges.',
        ],
        distractors: ['Kalverstraat', 'PC Hooftstraat', 'Utrechtsestraat', 'Rozengracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_leidseplein',
        name: 'Leidseplein',
        type: 'square',
        cityId: 'amsterdam',
        center: [52.3642, 4.8820],
        radius: 70,
        funFact: 'Historically served as a parking area for horse-drawn wagons entering the city from Leiden; today it is Amsterdam’s nightlife and performing arts epicenter.',
        clues: [
          'Vibrant entertainment plaza anchored by the neo-Renaissance Stadsschouwburg theatre.',
          'Flanked by legendary music venues Paradiso and Melkweg.',
          'Major nightlife junction near the entrance of Vondelpark.',
        ],
        distractors: ['Rembrandtplein', 'Dam Square', 'Museumplein', 'Nieuwmarkt'],
        difficulty: 'easy',
      },
      {
        id: 'ams_rembrandtplein',
        name: 'Rembrandtplein',
        type: 'square',
        cityId: 'amsterdam',
        center: [52.3662, 4.8965],
        radius: 70,
        funFact: 'Originally created as a butter and dairy market (Botermarkt) in 1668 before being renamed in 1876 in honor of Rembrandt van Rijn.',
        clues: [
          'Bustling nightlife square centered around a cast-iron statue of Rembrandt van Rijn.',
          'Previously known as the Botermarkt (Butter Market).',
          'Adjacent to Thorbeckeplein and the Amstel River.',
        ],
        distractors: ['Leidseplein', 'Dam Square', 'Waterlooplein', 'Muntplein'],
        difficulty: 'easy',
      },
      {
        id: 'ams_leidsegracht',
        name: 'Leidsegracht',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3656, 4.8856],
        path: [
          [52.3664, 4.8885], // Herengracht junction
          [52.3656, 4.8856], // Keizersgracht junction
          [52.3642, 4.8825], // Prinsengracht junction
          [52.3630, 4.8790], // Lijnbaansgracht / Marnixstraat
        ],
        funFact: 'Dug in 1658 as a waterway link toward Leiden; marked the boundary between the first and second phases of the 17th-century Canal Ring expansion.',
        clues: [
          'Picturesque transverse canal intersecting Herengracht, Keizersgracht, and Prinsengracht.',
          'Marked the historical construction boundary of the Canal Ring expansions.',
          'Provides a quiet, romantic residential canal view in the central belt.',
        ],
        distractors: ['Spiegelgracht', 'Reguliersgracht', 'Bloemgracht', 'Brouwersgracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_groenburgwal',
        name: 'Groenburgwal',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3685, 4.8988],
        path: [
          [52.3705, 4.8995], // Raamgracht junction
          [52.3685, 4.8988], // Staalmeestersbrug viewpoint
          [52.3668, 4.8978], // Amstel River confluence
        ],
        funFact: 'Claude Monet famously painted the view from the Staalmeestersbrug bridge along this canal looking toward the Zuiderkerk spire in 1874.',
        clues: [
          'Intimate canal famous for the classic postcard view of the Zuiderkerk church tower.',
          'Painted by French Impressionist master Claude Monet.',
          'Terminates at the Amstel River across from the Stopera.',
        ],
        distractors: ['Kloveniersburgwal', 'Zwanenburgwal', 'Singel', 'Herengracht'],
        difficulty: 'medium',
      },
      {
        id: 'ams_zwanenburgwal',
        name: 'Zwanenburgwal',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3688, 4.9008],
        path: [
          [52.3710, 4.9015], // Sint Antoniesbreestraat / Rembrandt House
          [52.3688, 4.9008], // Waterlooplein flea market
          [52.3665, 4.8995], // Amstel River confluence / Blauwbrug
        ],
        funFact: 'Rembrandt van Rijn lived and painted in his house facing this canal from 1639 to 1658 (now the Rembrandt House Museum).',
        clues: [
          'Canal in the historic Jewish Quarter and Waterlooplein flea market district.',
          'Home to the Rembrandt House Museum (Museum Het Rembrandthuis).',
          'Voted one of the top waterways in the historic eastern center.',
        ],
        distractors: ['Groenburgwal', 'Kloveniersburgwal', 'Oudezijds Voorburgwal', 'Singel'],
        difficulty: 'medium',
      },
      {
        id: 'ams_lijnbaansgracht',
        name: 'Lijnbaansgracht',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3640, 4.8810],
        path: [
          [52.3837, 4.8770], // Northern end near Brouwersgracht
          [52.3780, 4.8745], // Westerstraat / Lindengracht
          [52.3735, 4.8725], // Rozengracht / Raampoort
          [52.3690, 4.8755], // Elandsgracht
          [52.3635, 4.8820], // Leidseplein / Melkweg
          [52.3598, 4.8850], // Spiegelgracht
          [52.3590, 4.8930], // Reguliersgracht / Vijzelgracht
          [52.3595, 4.9010], // Utrechtsestraat / Frederiksplein
          [52.3608, 4.9070], // Amstel confluence
        ],
        funFact: 'Named after the ropewalks (lijnbanen) where long hemp ropes and ship rigging cables were twisted during the maritime Golden Age.',
        clues: [
          'Long outer crescent canal wrapping outside the Prinsengracht.',
          'Named after the historic maritime rope-making yards that lined its banks.',
          'Flanks the Melkweg music venue and the back of the Leidseplein theatre district.',
        ],
        distractors: ['Singelgracht', 'Prinsengracht', 'Keizersgracht', 'Herengracht'],
        difficulty: 'hard',
      },
      {
        id: 'ams_singelgracht',
        name: 'Singelgracht',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3615, 4.8800],
        path: [
          [52.3860, 4.8740], // Westerpark
          [52.3750, 4.8700], // Marnixkade / Hugo de Grootkade
          [52.3700, 4.8700], // Nassaukade / De Clercqstraat
          [52.3620, 4.8800], // Leidsebosje / Stadhouderskade
          [52.3585, 4.8870], // Rijksmuseum / Weteringschans
          [52.3580, 4.8940], // Heineken Experience / Ferdinand Bolstraat
          [52.3590, 4.9030], // Sarphatistraat / Frederiksplein
          [52.3605, 4.9100], // Weesperplein / Amstel
          [52.3620, 4.9220], // Tropenmuseum / Mauritskade
          [52.3670, 4.9280], // Artis / Plantage
        ],
        funFact: 'The outermost defensive moat of Amsterdam, surrounding the entire historic horseshoe-shaped city center with its 17th-century bastion fortifications.',
        clues: [
          'The outermost ring canal and defense moat encircling the entire UNESCO canal district.',
          'Bordered by the major perimeter thoroughfares Nassaukade, Stadhouderskade, and Mauritskade.',
          'Passes beside the Heineken Experience and the Tropenmuseum.',
        ],
        distractors: ['Singel', 'Lijnbaansgracht', 'Prinsengracht', 'Amstel'],
        difficulty: 'medium',
      },
      {
        id: 'ams_nieuwe_herengracht',
        name: 'Nieuwe Herengracht',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3668, 4.9080],
        path: [
          [52.3658, 4.9038], // Amstel River confluence
          [52.3668, 4.9080], // Hermitage garden & Hortus Botanicus
          [52.3678, 4.9125], // Plantage Muidergracht / Entrepotdok
        ],
        funFact: 'The eastern extension of Herengracht across the Amstel, bordered by the Hortus Botanicus (founded in 1638, one of the world\'s oldest botanical gardens).',
        clues: [
          'Eastern extension of Herengracht beyond the Amstel River.',
          'Directly faces the lush greenhouses of the historic Hortus Botanicus.',
          'Lined with grand Golden Age palaces in the Plantage district.',
        ],
        distractors: ['Nieuwe Keizersgracht', 'Nieuwe Prinsengracht', 'Herengracht', 'Entrepotdok'],
        difficulty: 'hard',
      },
      {
        id: 'ams_entrepotdok',
        name: 'Entrepotdok',
        type: 'canal',
        cityId: 'amsterdam',
        center: [52.3695, 4.9180],
        path: [
          [52.3710, 4.9090], // Kadijksplein
          [52.3695, 4.9180], // Monumental customs warehouses / Artis zoo
          [52.3680, 4.9270], // Singelgracht east
        ],
        funFact: 'Built as a secure customs-free bonded warehouse canal in 1827; today the monumental 800-meter row of warehouse facades directly overlooks the Artis Royal Zoo giraffe enclosure.',
        clues: [
          'Long straight canal basin famous for the longest contiguous row of historic warehouse facades in Europe.',
          'Directly borders the northern boundary of the Artis Royal Zoo.',
          'Originally a bonded customs harbor free from import tariffs.',
        ],
        distractors: ['Westerdok', 'Oosterdok', 'Dijksgracht', 'Plantage Muidergracht'],
        difficulty: 'hard',
      },
      {
        id: 'ams_westerpark',
        name: 'Westerpark',
        type: 'park',
        cityId: 'amsterdam',
        center: [52.3870, 4.8720],
        path: [
          [52.3855, 4.8820], // Haarlemmerweg entrance
          [52.3870, 4.8720], // Westergasfabriek cultural hub
          [52.3890, 4.8600], // Westward meadow
        ],
        funFact: 'The former 19th-century Imperial Gasworks (Westergasfabriek) buildings were transformed into a creative arts pavilion, indie cinema, and lush park.',
        clues: [
          'Vibrant cultural and ecological park northwest of the Jordaan.',
          'Features repurposed industrial red-brick gasworks buildings (Westergasfabriek).',
          'Hosts art exhibitions, food festivals, and lush water gardens.',
        ],
        distractors: ['Vondelpark', 'Oosterpark', 'Sarphatipark', 'Rembrandtpark'],
        difficulty: 'medium',
      },
      {
        id: 'ams_sarphatipark',
        name: 'Sarphatipark',
        type: 'park',
        cityId: 'amsterdam',
        center: [52.3540, 4.8960],
        path: [
          [52.3550, 4.8935], // Eerste van der Helststraat
          [52.3540, 4.8960], // Monument pond
          [52.3530, 4.8985], // Tweede van der Helststraat
        ],
        funFact: 'Named in honor of Jewish doctor, urban planner, and philanthropist Samuel Sarphati, who spearheaded modern sanitation and public health in 19th-century Amsterdam.',
        clues: [
          'English-style landscape park situated in the heart of De Pijp neighborhood.',
          'Surrounded by the vibrant Albert Cuyp street market.',
          'Features a grand central temple monument and weeping willows around a serene pond.',
        ],
        distractors: ['Vondelpark', 'Westerpark', 'Oosterpark', 'Beatrixpark'],
        difficulty: 'medium',
      },
    ],
  },
];
