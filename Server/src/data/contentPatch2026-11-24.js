/**
 * Unit and property content from the company's "Properties Description & Configuration Sheets"
 * (Google Drive, read 2026-11-24): bedrooms, bathrooms, size, beds, kitchen, in-unit amenities,
 * property facilities, address and Google Maps link. Where a sheet had no value (or an impossible one),
 * a sensible value is predicted and marked `// predicted`.
 *
 * Titles and descriptions are written from these facts in one commercial style.
 * Applied once by services/contentPatch.js; later admin edits are not overwritten.
 */

const PATCH_ID = 'unit-content-2026-11-24';

const search = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;

/* ——— Properties ——— */
const F = {
  reception: '24/7 Reception',
  security: '24/7 Security',
  parking: 'Free Parking',
  paidParking: 'Parking (extra fee)',
  noParking: 'No On-site Parking',
  housekeeping: 'Housekeeping Service',
  wifi: 'Free Wi-Fi',
  elevator: 'Elevator',
  gym: 'Free Gym',
  laundry: 'Laundry Service',
  pool: 'Swimming Pool Access',
  poolFee: 'Swimming Pool Access (extra fee)',
  doorman: '24/7 Doorman',
  intercom: 'Intercom',
  smartLock: 'Smart Lock Entry',
  beach: 'Beach Nearby',
  garden: 'Landscaped Gardens',
};

// where: how the area reads in a description; near: one location highlight
const PROPERTIES = {
  'prime-residence-zayed-hills': { where: 'Sheikh Zayed', near: 'close to Mazar Mall, Plaza Espania and Beverly Hills', address: 'D16 - Plot 13, Zayed Hills, Sheikh Zayed (near Mazar Mall and Plaza Espania)', facilities: [F.parking, F.wifi, F.elevator, F.intercom, F.housekeeping] },
  'prime-residence-sheikh-zayed': { where: 'Sheikh Zayed', near: 'in the residential heart of Sheikh Zayed, District 5', address: 'Building No.19, Al Mogawra 2, District 5, Sheikh Zayed', mapsUrl: search('Prime Residence Sheikh Zayed, Al Mogawra 2, District 5, Sheikh Zayed'), facilities: [F.reception, F.security, F.parking, F.wifi, F.elevator, F.housekeeping] },
  'prime-residence-zayed-heights': { where: 'Sheikh Zayed', near: 'in Zayed Heights, facing Spinneys hypermarket at El Bostan Square', address: 'Building No. 87 B, Gate 2, Zayed Heights Compound, in front of Spinneys, El Bostan Square, Sheikh Zayed', facilities: [F.reception, F.security, F.parking, F.wifi, F.elevator, F.smartLock, F.intercom, F.housekeeping] },
  'prime-hospitality': { where: 'New Cairo', near: 'beside Point 90 Mall and minutes from the AUC', address: '176 Al Sharq El Taameen Buildings, in front of Al Zohour Club Gate 10, beside Point 90 Mall, New Cairo', facilities: [F.reception, F.security, F.parking, F.gym, F.wifi, F.elevator, F.laundry, F.housekeeping] },
  'prime-select-arkadia': { where: 'Downtown Cairo', near: 'in Arkadia Mall on the Nile Corniche, beside the Fairmont Nile City', address: 'Building C, Arkadia Mall, Corniche El Nil, beside Fairmont Nile City Hotel, Cairo', mapsUrl: search('Arkadia Mall, Corniche El Nil, Cairo'), facilities: [F.security, F.paidParking, F.wifi, F.elevator, F.housekeeping] },
  'prime-residence-heliopolis': { where: 'Heliopolis', near: 'on Al Thawra Street in the heart of Heliopolis', address: '58 Al Thawra St., beside Palestine Hospital, Heliopolis, Cairo', mapsUrl: search('Prime Residence Heliopolis, 58 Al Thawra Street, Heliopolis'), facilities: [F.wifi, F.elevator, F.housekeeping] },
  'prime-residence-kattameya': { where: 'Kattameya', near: 'inside Stone Residence compound with access to its swimming pools', address: 'Building No.148, Stone Residence Compound, Kattameya, Cairo', mapsUrl: search('Stone Residence Compound, Kattameya'), facilities: [F.reception, F.security, F.parking, F.wifi, F.pool, F.elevator, F.housekeeping] },
  'prime-residence-kattameya-golf': { where: 'Kattameya', near: 'in West Golf, in front of Kattameya Golf Gate 3', address: 'Building No. 17, Street 21, West Golf, in front of Gate 3, Kattameya Golf, New Cairo', facilities: [F.reception, F.security, F.parking, F.wifi, F.elevator, F.smartLock, F.housekeeping] },
  'prime-residence-point-90': { where: 'New Cairo', near: 'right behind Point 90 Mall', address: 'Building No.24, Al Sharq El Taameen Buildings, behind Point 90 Mall, New Cairo', mapsUrl: search('Prime Residence Point 90, New Cairo'), facilities: [F.reception, F.security, F.parking, F.wifi, F.elevator, F.laundry, F.housekeeping] },
  'prime-residence-new-alamein': { where: 'New Alamein', near: 'in New Alamein City on the North Coast', address: 'Al Alamein City, El Alamein, Marsa Matrouh 51718', mapsUrl: 'https://maps.app.goo.gl/2pzooecdMwbiJyrv5', facilities: [F.reception, F.security, F.paidParking, F.gym, F.wifi, F.elevator, F.laundry, F.housekeeping] },
  'prime-select-masaken-sheraton': { where: 'Heliopolis', near: 'in Ocean Blue compound beside Sun City Mall', address: 'Ocean Blue Compound, beside Sun City Mall, Masaken Sheraton, Heliopolis', mapsUrl: 'https://maps.app.goo.gl/ujR1eB9Fbx2bE9im7', facilities: [F.security, F.parking, F.poolFee, F.wifi, F.housekeeping] },
  'prime-select-one-kattameya': { where: 'Kattameya', near: 'inside One Kattameya compound', address: 'One Kattameya Compound, in front of El Leithy Group, Kattameya', mapsUrl: 'https://maps.app.goo.gl/MKZ6d6pstZvTUcWv6', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-katameya-bavaria-town': { where: 'Kattameya', near: 'inside Bavaria Town compound', address: 'Bavaria Town Compound, Kattameya, Cairo', mapsUrl: 'https://maps.app.goo.gl/PjJnAKDHMzmeDVaE8', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'porto-new-cairo': { where: 'New Cairo', near: 'in Porto New Cairo, opposite the AUC on 90th Street', address: 'Porto New Cairo Compound, in front of AUC, South 90th Street, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/ZUifsL3eU7ByncDw6', facilities: [F.security, F.paidParking, F.pool, F.wifi, F.housekeeping] },
  'prime-select-lake-view': { where: 'New Cairo', near: 'inside Lake View compound in the 5th Settlement', address: 'Lake View Compound, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/KNninxReUrUnVrgW8', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'the-village-gate': { where: 'New Cairo', near: 'in Village Gate compound on South 90th Street', address: 'Village Gate Compound, South 90th Street, beside Faisal Islamic Bank, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/wBFf8Wn2s92uPT829', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-90-avenue': { where: 'New Cairo', near: 'in 90 Avenue compound beside the AUC', address: '90 Avenue Compound, beside AUC, South 90th Street, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/W5QUn36a4CVR5htf9', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'al-manzel-lotus-new-cairo': { where: 'New Cairo', near: 'in Northern Lotus, 5th Settlement', address: 'Building No.24, Northern Lotus, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/3aVTPvZd4ZusnGJK9', facilities: [F.doorman, F.parking, F.wifi, F.housekeeping] },
  'prime-select-galleria-moon-valley': { where: 'New Cairo', near: 'in Galleria Moon Valley compound, with swimming pool access', address: 'Galleria Moon Valley Compound, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/wNenN6RgCeyzUnJ18', facilities: [F.security, F.parking, F.pool, F.wifi, F.housekeeping] },
  'prime-select-eastown-sodic': { where: 'New Cairo', near: 'in Sodic Eastown beside the AUC', address: 'Eastown Sodic Compound, beside AUC, South 90th Street, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/QfhxH7ep9GAWzody7', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'marvel-city-new-cairo': { where: 'New Cairo', near: 'in Marvel City beside The Spot and Midtown malls, with free pool access', address: 'Marvel City Compound, beside The Spot Mall and Midtown Mall, 5th Settlement, New Cairo', mapsUrl: 'https://maps.app.goo.gl/guSi2Csrkfmezz7EA', facilities: [F.security, F.parking, F.pool, F.wifi, F.housekeeping] },
  'point-90-new-cairo': { where: 'New Cairo', near: 'right behind Point 90 Mall', address: '190 El Sharq El Taameen Buildings, behind Point 90 Mall, 5th Settlement, New Cairo', mapsUrl: search('Prime Select Point 90, New Cairo'), facilities: [F.parking, F.gym, F.wifi, F.laundry, F.housekeeping] },
  'prime-select-palm-hills-village-garden-kattameya': { where: 'New Cairo', near: 'in Palm Hills Village Garden, Golden Square', address: 'Building 41, Palm Hills Village Garden Kattameya, Golden Square, 5th Settlement, New Cairo', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-el-batal': { where: 'Mohandessin', near: 'on El Batal Ahmed Abdel Aziz Street in Mohandessin', address: '4 El Batal Ahmed Abdel Aziz St., Mohandessin, Giza', mapsUrl: 'https://maps.app.goo.gl/aZXQTJS81uHVLLLMA', facilities: [F.security, F.paidParking, F.wifi, F.housekeeping] },
  'prime-select-sodic-villette': { where: 'New Cairo', near: 'in Sodic Villette, Golden Square, beside Galleria Moon Valley', address: 'Building 5B, Sodic Villette Compound, Golden Square, beside Galleria Moon Valley and Lake View, New Cairo', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-west-zamalek': { where: 'Zamalek', near: 'on a quiet Zamalek street beside the Marriott Hotel', address: '4 Al Sheikh Al Marsafi St., Zamalek, beside Cairo Marriott Hotel', mapsUrl: 'https://maps.app.goo.gl/mEsn1pxWwU8JYzj89', facilities: [F.wifi, F.housekeeping, F.noParking] },
  'prime-select-zamalek-central': { where: 'Zamalek', near: 'on the 14th floor at 140 26th of July Street, Zamalek', address: 'Building No.140, 26th of July Street, Zamalek, Cairo (14th floor)', mapsUrl: 'https://maps.app.goo.gl/SvsWY5jodUohRUg29', facilities: [F.wifi, F.elevator, F.housekeeping] },
  'prime-select-gamet-el-dewal': { where: 'Dokki', near: 'on Gameat El Dewal El Arabia Street', address: '61 / 59 Gameat El Dewal El Arabia St., Dokki, Giza', mapsUrl: 'https://maps.app.goo.gl/yxK56jfNFwoRVZh29', facilities: [F.security, F.paidParking, F.wifi, F.housekeeping] },
  'prime-select-mall-of-arabia': { where: '6th of October', near: 'in Aeon Towers beside Mall of Arabia', address: 'Aeon Towers Compound, beside Mall of Arabia, 6th of October', mapsUrl: 'https://maps.app.goo.gl/GZU5RoeBdhMxzt6F9', facilities: [F.security, F.parking, F.wifi, F.elevator, F.housekeeping] },
  'prime-select-the-crown': { where: '6th of October', near: 'in The Crown by Palm Hills', address: 'The Crown Palm Hills Compound, 6th of October', mapsUrl: 'https://maps.app.goo.gl/kiZLXKzntempbmsi6', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-new-giza': { where: 'New Giza', near: 'in New Giza, 10 minutes from the Pyramids and the Grand Egyptian Museum', address: 'New Giza Compound, beside New Giza University, 6th of October (Pyramids / Grand Egyptian Museum 10 min, Sphinx Airport 25 min)', mapsUrl: 'https://maps.app.goo.gl/MBRiQURFEP2TN8YTA', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-west-sodic': { where: '6th of October', near: 'in West Sodic, Dahshour Link', address: 'West Sodic Compound, Dahshour Link, 6th of October', mapsUrl: 'https://maps.app.goo.gl/AACZz1ftideGumUf9', facilities: [F.security, F.parking, F.wifi, F.housekeeping] },
  'prime-select-san-stefano-alexandria': { where: 'Alexandria', near: 'at San Stefano Grand Plaza on the Alexandria seafront', address: 'Building No.3, San Stefano Grand Plaza, Alexandria', mapsUrl: 'https://maps.app.goo.gl/JcugVri5UPemqH1B8', facilities: [F.security, F.paidParking, F.wifi, F.elevator, F.housekeeping] },
  'prime-select-gleem': { where: 'Alexandria', near: 'on El Geish Road in Gleem, facing the Mediterranean', address: '375 El Geish St., Qased Kareem Building, Gleem, Alexandria', mapsUrl: 'https://maps.app.goo.gl/rENhG1PsRTRq9GUo6', facilities: [F.security, F.wifi, F.elevator, F.housekeeping, F.noParking] },
  'prime-select-raml-station-alexandria': { where: 'Alexandria', near: 'on Saad Zaghloul Street at Raml Station', address: 'Building No.71, Saad Zaghloul St., Raml Station, Alexandria', mapsUrl: 'https://maps.app.goo.gl/VbeX7KEvksxt9FY96', facilities: [F.wifi, F.elevator, F.housekeeping] },
  'prime-inn-10th-of-ramadan': { where: '10th of Ramadan', near: 'on Youssef Wahbi Street, beside Al Seddik International School', address: 'Villa No.113, Youssef Wahbi St., Al Mogawra 9, 10th of Ramadan', mapsUrl: 'https://maps.app.goo.gl/XtNoQkZZwGapMGXT8', facilities: [F.reception, F.security, F.wifi, F.housekeeping] },
  'almanzel-sheikh-zayed': { where: 'Sheikh Zayed', near: 'in a private villa with free access to a swimming pool', address: 'Villa No.81, Al Mogawra 2, District 9, Sheikh Zayed', mapsUrl: search('Al Manzel Sheikh Zayed'), facilities: [F.reception, F.security, F.parking, F.wifi, F.pool, F.housekeeping] },
  'prime-inn-andalus-new-cairo': { where: 'New Cairo', near: 'on Al Madares Street in Al Andalus, 5th Settlement', address: 'Building No.33, 33 Al Madares St., Al Andalus, 5th Settlement, New Cairo', mapsUrl: 'https://www.google.com/maps?q=29.992752,31.523952', facilities: [F.reception, F.security, F.parking, F.wifi, F.elevator, F.housekeeping] },
  'prime-boutique': { where: 'Heliopolis', near: 'above Groppi on Al Ahram Street in Korba', address: '21 Al Ahram St., Korba, Heliopolis, above Groppi', facilities: [F.reception, F.security, F.wifi, F.elevator, F.housekeeping] },
  'prime-holidays-mountain-viewras-elhekma': { where: 'Ras El Hekma', near: 'in Mountain View Ras El Hekma at KM 200 on the North Coast', address: 'Mountain View Compound, Ras El Hekma, KM 200, North Coast', mapsUrl: 'https://maps.app.goo.gl/YbkLHgwwe95VN4Ug9', facilities: [F.security, F.parking, F.wifi, F.housekeeping, F.beach] },
  'prime-holidays-cesar-bay': { where: 'the North Coast', near: 'in Caesar Bay at KM 200', address: 'Caesar Bay Compound, KM 200, North Coast', mapsUrl: 'https://maps.app.goo.gl/fSGK97ErdVXuacYo8', facilities: [F.security, F.parking, F.wifi, F.housekeeping, F.beach] },
  'prime-holidays-hacienda-bay': { where: 'the North Coast', near: 'in Hacienda Bay on the North Coast', address: 'Hacienda Bay Compound, North Coast', mapsUrl: 'https://maps.app.goo.gl/ZmkkBp4RmXtxPs237', facilities: [F.security, F.parking, F.wifi, F.housekeeping, F.beach] },
  'prime-holidays-amwaj': { where: 'the North Coast', near: 'in Amwaj on the North Coast', address: 'Amwaj Compound, North Coast', mapsUrl: 'https://maps.app.goo.gl/iiJViZvs6zTynF3X8', facilities: [F.security, F.parking, F.wifi, F.housekeeping, F.beach] },
  'prime-holidays-seashell': { where: 'the North Coast', near: 'in Seashell, Sidi Abdel Rahman, KM 136', address: 'KM 136, Alexandria–Matrouh Desert Road, Sidi Abdel Rahman, North Coast', mapsUrl: 'https://maps.app.goo.gl/CHHitbpJfaqEHyF17', facilities: [F.security, F.parking, F.wifi, F.housekeeping, F.beach] },
};

/* ——— Units ———
 * u(slug, title, bedrooms, bathrooms, sqm, bedType, beds, extras)
 * extras: { half: true (an extra half bath), features: [], kitchen: 'full' | 'kitchenette' | 'fridge' | 'none',
 *           washer: false, oven: false, nespresso: true, unitType, predicted: [fields] }
 */
const u = (slug, title, bedrooms, bathrooms, areaSqm, bedType, beds, x = {}) => ({ slug, title, bedrooms, bathrooms, areaSqm, bedType, beds, ...x });

const UNITS = [
  // Prime Residence Zayed Hills
  u('prime-residence-zayed-hills-standard-studio', 'Standard Studio', 0, 1, 35, 'Queen Size Bed', 'a queen bed'),
  u('prime-residence-zayed-hills-superior-studio', 'Superior Studio', 0, 1, 35, 'Queen Size Bed', 'a queen bed and a sofa'),
  u('prime-residence-zayed-hills-deluxe-studio', 'Deluxe Studio', 0, 1, 37, 'Queen Size Bed', 'a queen bed and a sofa'),
  u('prime-residence-zayed-hills-deluxe-studio-twin-beds', 'Deluxe Studio, Twin Beds', 0, 1, 38, 'Twin Beds', 'twin beds and a sofa'),
  u('prime-residence-zayed-hills-standard-one-bedroom', 'Standard One Bedroom Apartment', 1, 1, 46, 'Queen Size Bed', 'a queen bedroom and a living area with sofa'),
  u('prime-residence-zayed-hills-standard-one-bedroom-twin-beds', 'Standard One Bedroom Apartment, Twin Beds', 1, 1, 48, 'Twin Beds', 'a twin bedroom and a living area with sofa'),
  u('prime-residence-zayed-hills-superior-one-bedroom', 'Superior One Bedroom Apartment', 1, 1, 52, 'Queen Size Bed', 'a queen bedroom and a living area with sofa'),

  // Prime Residence Sheikh Zayed
  u('prime-residence-sheikh-zayed-studio-standard', 'Standard Studio', 0, 1, 40, 'King Size Bed', 'a king bed'),
  u('prime-residence-sheikh-zayed-studio-superior', 'Superior Studio', 0, 1, 50, 'King Size Bed', 'a king bed'),
  u('prime-residence-sheikh-zayed-1-bedroom-standard', 'Standard One Bedroom Apartment', 1, 1, 65, 'King Size Bed', 'a king bedroom and a living area with sofa'),
  u('prime-residence-sheikh-zayed-1-bedroom-superior-king-bed', 'Superior One Bedroom Apartment with Terrace, King Bed', 1, 1, 75, 'King Size Bed', 'a king bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-residence-sheikh-zayed-1-bedroom-superior-twin-bed', 'Superior One Bedroom Apartment with Balcony, Twin Beds', 1, 1, 75, 'Twin Beds', 'a twin bedroom and a living area with sofa', { features: ['Balcony'] }),

  // Prime Residence Zayed Heights
  u('prime-residence-zayed-heights-standard-studio', 'Standard Studio with Terrace', 0, 1, 30, 'Queen Size Bed', 'a queen bed and a sofa', { features: ['Terrace'] }),
  u('prime-residence-zayed-heights-standard-one-bedroom-apartment', 'Standard One Bedroom Apartment with Terrace', 1, 1, 40, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-residence-zayed-heights-standard-one-bedroom-twin-bed', 'Standard One Bedroom Apartment with Terrace, Twin Beds', 1, 1, 40, 'Twin Beds', 'a twin bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-residence-zayed-heights-superior-one-bedroom-apartment', 'Superior One Bedroom Apartment with Terrace', 1, 1, 50, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-residence-zayed-heights-standard-two-bedrooms', 'Standard Two Bedroom Apartment', 2, 2, 75, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa'),
  u('prime-residence-zayed-heights-deluxe-two-rooms-with-terrace', 'Deluxe Two Bedroom Apartment with Terrace', 2, 2, 110, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-residence-zayed-heights-three-bedrooms-apartments', 'Three Bedroom Apartment with Balcony', 3, 2, 245, 'Queen & Twin Beds', 'a queen bedroom, two twin bedrooms and a living area with sofa', { half: true, features: ['Balcony'] }),

  // Prime Residence New Cairo
  u('prime-hospitality-studio-apartment', 'Standard Studio', 0, 1, 50, 'King Size Bed', 'a king bed and a sofa bed'),
  u('prime-hospitality-1-bedroom-apartment', 'Standard One Bedroom Apartment with Balcony', 1, 1, 65, 'King Size Bed', 'a king bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-hospitality-1-bedroom-deluxe-apt-king', 'Deluxe One Bedroom Apartment with Balcony, King Bed', 1, 1, 75, 'King Size Bed', 'a king bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-hospitality-1-bedroom-deluxe-apt-double', 'Deluxe One Bedroom Apartment with Balcony, Twin Beds', 1, 1, 75, 'Twin Beds', 'a twin bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-hospitality-one-bedroom-with-garden', 'One Bedroom Apartment with Garden', 1, 1, 70, 'King Size Bed', 'a king bedroom and a living area with sofa', { features: ['Private Garden', 'Balcony'] }),
  u('prime-hospitality-2-bedroom-apartment', 'Two Bedroom Apartment', 2, 2, 90, 'King & Twin Beds', 'a king bedroom, a twin bedroom and a living area with sofa'),

  // Prime Select Arkadia (Arkadia Mall, Nile Corniche)
  u('prime-select-arkadia-standard-std-cityview-king-ie', 'Standard Studio, City View, King Bed', 0, 1, 45, 'King Size Bed', 'a king bed', { features: ['City View'] }),
  u('prime-select-arkadia-standard-std-cityview-king-ks', 'Standard Studio, City View, King Bed', 0, 1, 45, 'King Size Bed', 'a king bed', { features: ['City View'] }),
  u('prime-select-arkadia-standard-std-cityview-twin-ie', 'Standard Studio, City View, Twin Beds', 0, 1, 45, 'Twin Beds', 'twin beds', { features: ['City View'] }),
  u('prime-select-arkadia-standard-std-nileview-ie', 'Standard Studio, Nile View', 0, 1, 50, 'King Size Bed', 'a king bed and a sofa', { features: ['Nile View'] }),
  u('prime-select-arkadia-standard-stdnileviewbalcny-ie', 'Standard Studio with Balcony, Nile View', 0, 1, 50, 'King Size Bed', 'a king bed and a sofa', { features: ['Nile View', 'Balcony'] }),
  u('prime-select-arkadia-superior-std-cityviewblcny-ks', 'Superior Studio with Balcony, City View', 0, 1, 50, 'Queen Size Bed', 'a queen bed', { features: ['City View', 'Balcony'] }),
  u('prime-select-arkadia-deluxe-std-nile-view-ks', 'Deluxe Studio, Nile View', 0, 1, 60, 'Queen Size Bed', 'a queen bed', { features: ['Nile View'] }),
  u('prime-select-arkadia-deluxe-std-nileview-balcny-ks', 'Deluxe Studio with Balcony, Nile View', 0, 1, 55, 'Queen Size Bed', 'a queen bed', { features: ['Nile View', 'Balcony'] }),
  u('prime-select-arkadia-superior-1-bdr-aptcityview-ie', 'Superior One Bedroom Apartment, City View', 1, 1, 65, 'King Size Bed', 'a king bedroom and a sofa bed', { features: ['City View'] }),
  u('prime-select-arkadia-deluxe-1-bdr-apt-city-view-ie', 'Deluxe One Bedroom Apartment, City View', 1, 1, 70, 'King Size Bed', 'a king bedroom and a sofa bed', { features: ['City View'], predicted: ['areaSqm'] }),
  u('prime-select-arkadia-standard-2-bdr-aptcityview-ie', 'Standard Two Bedroom Apartment, City View', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['City View'] }),
  u('prime-select-arkadia-superior-2-bdr-city-view-ks', 'Superior Two Bedroom Apartment, City View', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['City View', 'Balcony'] }),
  u('prime-select-arkadia-superior-2-bdr-aptnileview-ks', 'Superior Two Bedroom Apartment, Nile View', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['Nile View', 'Balcony'] }),
  u('prime-select-arkadia-deluxe-2-bdr-apt-nile-view-ie', 'Deluxe Two Bedroom Apartment, Nile View', 2, 2, 160, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['Nile View', 'Balcony'] }),
  u('prime-select-arkadia-deluxe-3-bdr-apt-nile-view-ks', 'Deluxe Three Bedroom Apartment with Nanny Room, Nile View', 3, 3, 280, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a nanny room', { features: ['Nile View', 'Balcony'] }),
  u('prime-select-arkadia-deluxe-4-bdr-apt-nile-view-ks', 'Deluxe Four Bedroom Apartment, Nile View', 4, 3, 305, 'Queen & Twin Beds', 'two queen bedrooms and two twin bedrooms', { features: ['Nile View', 'Balcony'] }),

  // Prime Residence Heliopolis
  u('prime-residence-heliopolis-standard-studio', 'Standard Studio', 0, 1, 30, 'King Size Bed', 'a king bed and a sofa'),
  u('prime-residence-heliopolis-superior-studio', 'Superior Studio', 0, 1, 35, 'King Size Bed', 'a king bed and a sofa'),
  u('prime-residence-heliopolis-deluxe-studio', 'Deluxe Studio', 0, 1, 40, 'King Size Bed', 'a king bed and a sofa'),
  u('prime-residence-heliopolis-standard-one-bedroom', 'Standard One Bedroom Apartment', 1, 1, 60, 'King Size Bed', 'a king bedroom and a living area with sofa'),
  u('prime-residence-heliopolis-superior-one-bedroom', 'Superior One Bedroom Apartment', 1, 1, 65, 'King Size Bed', 'a king bedroom and a living area with sofa'),

  // Prime Residence Kattameya (Stone Residence)
  u('prime-residence-kattameya-studio', 'Standard Studio with Balcony', 0, 1, 50, 'King Size Bed', 'a king bed and a sofa', { features: ['Balcony'], washer: false }),
  u('prime-residence-kattameya-one-bedroom-standard', 'Standard One Bedroom Apartment with Balcony', 1, 1, 75, 'King Size Bed', 'a king bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-residence-kattameya-one-bedroom-duplex-with-roof', 'Duplex One Bedroom Apartment with Roof', 1, 1, 75, 'King Size Bed', 'a king bedroom and a living area with sofa bed', { features: ['Rooftop', 'Balcony'] }),
  u('prime-residence-kattameya-two-bedroom', 'Two Bedroom Apartment with Terrace', 2, 2, 128, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { features: ['Terrace'] }),

  // Prime Residence Kattameya Golf
  u('prime-residence-kattameya-golf-superior-one-bedroom-apartment', 'Superior One Bedroom Apartment', 1, 1, 85, 'Queen Size Bed', 'a queen bedroom and a living area'),
  u('prime-residence-kattameya-golf-standard-two-bedroom-apartment', 'Standard Two Bedroom Apartment', 2, 2, 105, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom'),
  u('prime-residence-kattameya-golf-deluxe-two-bedroom-apartment', 'Deluxe Two Bedroom Apartment', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { half: true }),
  u('prime-residence-kattameya-golf-superior-two-bedroom-apartment', 'Superior Two Bedroom Apartment with Balcony', 2, 2, 145, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['Balcony'] }),

  // Prime Residence Point 90
  u('prime-residence-point-90-studio-standard', 'Standard Studio', 0, 1, 45, 'Queen Size Bed', 'a queen bed and an L-shaped sofa'),
  u('prime-residence-point-90-studio-superior', 'Superior Studio with Balcony', 0, 1, 50, 'Queen Size Bed', 'a queen bed and an L-shaped sofa', { features: ['Balcony'] }),
  u('prime-residence-point-90-one-bedroom-standard', 'Standard One Bedroom Apartment', 1, 1, 70, 'Queen Size Bed', 'a queen bedroom and a living area with L-shaped sofa'),
  u('prime-residence-point-90-one-bedroom-superior', 'Superior One Bedroom Apartment with Balcony', 1, 1, 80, 'Twin Beds', 'a twin bedroom and a living area with L-shaped sofa', { features: ['Balcony'] }),
  u('prime-residence-point-90-two-bedrooms', 'Two Bedroom Apartment', 2, 2, 100, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area', { predicted: ['bedType'] }),

  // Prime Residence New Alamein
  u('prime-residence-new-alamein-studio-garden-view', 'Studio, Garden View', 0, 1, 45, 'King Size Bed', 'a king bed and a sofa bed', { features: ['Garden View'] }),
  u('prime-residence-new-alamein-studio-pool-view', 'Studio, Pool View', 0, 1, 45, 'King Size Bed', 'a king bed and a sofa bed', { features: ['Pool View'] }),
  u('prime-residence-new-alamein-one-bedroom-garden-view', 'One Bedroom Apartment with Balcony, Garden View', 1, 1, 65, 'Twin Beds', 'a twin bedroom and a living area with sofa bed', { features: ['Garden View', 'Balcony'] }),
  u('prime-residence-new-alamein-one-bedroom-pool-view', 'One Bedroom Apartment with Balcony, Pool View', 1, 1, 65, 'Twin Beds', 'a twin bedroom and a living area with sofa bed', { features: ['Pool View', 'Balcony'] }),
  u('prime-residence-new-alamein-two-bedrooms-garden-view', 'Two Bedroom Apartment, Garden View', 2, 2, 95, 'King & Twin Beds', 'a king bedroom, a twin bedroom and a living area with sofa bed', { features: ['Garden View'] }),
  u('prime-residence-new-alamein-two-bedrooms-pool-view', 'Two Bedroom Apartment, Pool View', 2, 2, 95, 'King & Twin Beds', 'a king bedroom, a twin bedroom and a living area with sofa bed', { features: ['Pool View'] }),
  u('prime-residence-new-alamein-three-bedrooms-pool-view', 'Three Bedroom Apartment, Pool View', 3, 2, 120, 'King & Twin Beds', 'a king bedroom, two twin bedrooms and a living area with sofa bed', { features: ['Pool View'] }),
  u('prime-residence-new-alamein-three-bedrooms-back-view', 'Three Bedroom Apartment', 3, 2, 120, 'King & Twin Beds', 'a king bedroom, two twin bedrooms and a living area with sofa bed', { predicted: ['bedrooms', 'bathrooms', 'areaSqm', 'bedType'] }),

  // Prime Select Masaken Sheraton (Ocean Blue)
  u('prime-select-masaken-sheraton-standard-two-bdr-10802', 'Standard Two Bedroom Apartment', 2, 2, 140, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa'),
  u('prime-select-masaken-sheraton-superior-two-bdr-5802', 'Superior Two Bedroom Apartment', 2, 2, 140, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa'),

  // Prime Select One Kattameya
  u('prime-select-one-kattameya-standard-studio', 'Standard Studio', 0, 1, 50, 'Queen Size Bed', 'a queen bed and a sofa'),
  u('prime-select-one-kattameya-superior-studio-with-terrace', 'Superior Studio with Terrace', 0, 1, 50, 'Queen Size Bed', 'a queen bed and a sofa', { features: ['Terrace'] }),
  u('prime-select-one-kattameya-junior-two-bedrooms', 'Junior Two Bedroom Apartment with Balcony', 2, 1, 90, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-select-one-kattameya-two-bedrooms', 'Two Bedroom Apartment', 2, 2, 130, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa'),
  u('prime-select-one-kattameya-two-bedrooms-with-terrace', 'Two Bedroom Apartment with Terrace', 2, 2, 130, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { features: ['Terrace'] }),
  u('prime-select-one-kattameya-3-bedrooms-apartment', 'Three Bedroom Apartment', 3, 3, 180, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a living area with sofa'),

  // Prime Select Katameya Bavaria Town
  u('prime-select-katameya-bavaria-town-studio', 'Standard Studio', 0, 1, 45, 'Queen Size Bed', 'a queen bed and a sofa', { washer: false, extraAmenities: ['Mini Bar'] }),
  u('prime-select-katameya-bavaria-town-one-bedroom-standard', 'Standard One Bedroom Apartment', 1, 1, 65, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { washer: false }),
  u('prime-select-katameya-bavaria-town-one-bedroom-superior', 'Superior One Bedroom Apartment with Balcony', 1, 1, 70, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { features: ['Balcony'] }),
  u('prime-select-katameya-bavaria-town-one-bedroom-deluxe', 'Deluxe One Bedroom Apartment', 1, 1, 75, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { washer: false }),
  u('prime-select-katameya-bavaria-town-two-bedrooms-apartment', 'Two Bedroom Apartment with Balcony', 2, 1, 90, 'Queen Size Bed', 'two queen bedrooms and a living area with sofa', { features: ['Balcony'] }),

  // Porto New Cairo
  u('porto-new-cairo-2-bedrooms-a109', 'Duplex Two Bedroom Apartment', 2, 2, 143, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom over two levels', { half: true, features: ['Duplex'] }),
  u('porto-new-cairo-2-bedrooms-d525', 'Duplex Two Bedroom Apartment, High Floor', 2, 2, 143, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom over two levels', { half: true, features: ['Duplex'] }),

  // Prime Select Lake View / Village Gate / 90 Avenue / Lotus / Moon Valley
  u('prime-select-lake-view-two-bedrooms', 'Two Bedroom Apartment', 2, 2, 150, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true }),
  u('the-village-gate-two-bedrooms', 'Two Bedroom Apartment with Balcony', 2, 2, 140, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['Balcony'] }),
  u('prime-select-90-avenue-two-bedrooms', 'Two Bedroom Apartment', 2, 3, 150, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa'),
  u('al-manzel-lotus-new-cairo-2-bedrooms', 'Two Bedroom Apartment with Living Room', 2, 2, 180, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a separate living room', { features: ['Balcony'], nespresso: true }),
  u('prime-select-galleria-moon-valley-2-bedroom-apartment-z3', 'Two Bedroom Apartment with Balcony, Building Z3', 2, 2, 140, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { features: ['Balcony'] }),
  u('prime-select-galleria-moon-valley-2-bedroom-apartment-z5', 'Two Bedroom Apartment with Balcony, Building Z5', 2, 2, 140, 'Queen Size Bed', 'two queen bedrooms', { features: ['Balcony'] }),

  // Prime Select Eastown Sodic
  u('prime-select-eastown-sodic-studio', 'Studio with Rooftop Terrace', 0, 1, 65, 'Queen Size Bed', 'a queen bed', { features: ['Rooftop'] }),
  u('prime-select-eastown-sodic-studioo', 'Studio with Rooftop Terrace, Building 31', 0, 1, 65, 'Queen Size Bed', 'a queen bed', { features: ['Rooftop'], predicted: ['areaSqm'] }),
  u('prime-select-eastown-sodic-3-bedrooms-apartment', 'Three Bedroom Apartment with Balcony and Nanny Room', 3, 3, 180, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a nanny room', { features: ['Balcony'] }),
  u('prime-select-eastown-sodic-three-bedrooms-apartment', 'Three Bedroom Apartment with Nanny Room', 3, 3, 180, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a nanny room', { features: ['Balcony'] }),
  u('prime-select-eastown-sodic-3-bedrooms-with-garden', 'Three Bedroom Apartment with Garden', 3, 2, 190, 'Queen & Twin Beds', 'two queen bedrooms and a twin bedroom', { features: ['Private Garden', 'Balcony'] }),

  // Marvel City / Point 90 (Select) / Village Garden
  u('marvel-city-new-cairo-3-bedrooms', 'Three Bedroom Apartment with Balcony', 3, 2, 150, 'Queen & Twin Beds', 'two queen bedrooms and a twin bedroom', { half: true, features: ['Balcony'] }),
  u('point-90-new-cairo-2-bedroom-apart-point-90-mall', 'Two Bedroom Apartment with Balcony', 2, 1, 180, 'Queen Size Bed', 'a queen bedroom and a second bedroom with a single bed', { half: true, features: ['Balcony'] }),
  u('point-90-new-cairo-3-bedroom-apart-point-90-mall', 'Three Bedroom Apartment with Balcony', 3, 1, 190, 'Queen Size Bed', 'a queen bedroom and two bedrooms with single beds', { half: true, features: ['Balcony'] }),
  u('prime-select-palm-hills-village-garden-kattameya-two-bedrooms-apartment', 'Two Bedroom Apartment', 2, 2, 150, 'Queen & Twin Beds', 'a queen bedroom with balcony, a twin bedroom and a living area with sofa', { features: ['Balcony'] }),

  // Prime Select El Batal (Mohandessin)
  u('prime-select-el-batal-one-bedroom', 'One Bedroom Apartment with Balcony', 1, 1, 75, 'Queen Size Bed', 'a queen bedroom and a living area', { features: ['Balcony'] }),
  u('prime-select-el-batal-blue-studio', 'Studio, Blue Design', 0, 1, 55, 'Queen Size Bed', 'a queen bed', { washer: false }),
  u('prime-select-el-batal-grey-studio', 'Studio, Grey Design', 0, 1, 50, 'Queen Size Bed', 'a queen bed', { washer: false }),

  // Prime Select Sodic Villette
  u('prime-select-sodic-villette-standard-studio', 'Rooftop Studio', 0, 1, 45, 'Queen Size Bed', 'a queen bed', { features: ['Rooftop'] }),
  u('prime-select-sodic-villette-two-bedrooms-apartment', 'Two Bedroom Apartment', 2, 2, 140, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true }),

  // Prime Select West Zamalek (Saray Al Gezira)
  u('prime-select-west-zamalek-one-bdr-apartment', 'One Bedroom Apartment', 1, 1, 60, 'Queen Size Bed', 'a queen bedroom and a living area with sofa', { kitchen: 'american', nespresso: true }),
  u('prime-select-west-zamalek-one-bedroom-with-terrace', 'One Bedroom Apartment with Garden Terrace', 1, 1, 75, 'Queen Size Bed', 'a queen bedroom', { features: ['Terrace'], kitchen: 'american', nespresso: true }),
  u('prime-select-west-zamalek-two-bedrooms-apartment', 'Two Bedroom Apartment', 2, 2, 80, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { kitchen: 'american', nespresso: true }),

  // Prime Select Zamalek Central (14th floor, kitchenettes)
  u('prime-select-zamalek-central-standard-studio-city-view', 'Standard Studio, City View', 0, 1, 35, 'Queen Size Bed', 'a queen bed', { features: ['City View'], kitchen: 'kitchenette', washer: false }),
  u('prime-select-zamalek-central-superior-studio-twin-bed', 'Superior Studio, City View, Twin Beds', 0, 1, 35, 'Twin Beds', 'twin beds', { features: ['City View'], kitchen: 'kitchenette', washer: false }),
  u('prime-select-zamalek-central-superior-studio-nile-view', 'Superior Studio with Balcony, Nile View', 0, 1, 35, 'Queen Size Bed', 'a queen bed', { features: ['Nile View', 'Balcony'], kitchen: 'kitchenette', washer: false }),
  u('prime-select-zamalek-central-deluxe-studio-twin-bed', 'Deluxe Studio, City View, Twin Beds', 0, 1, 50, 'Twin Beds', 'twin beds', { features: ['City View'], kitchen: 'kitchenette', washer: false }),
  u('prime-select-zamalek-central-deluxe-studio-nile-view', 'Deluxe Studio, Nile View', 0, 1, 40, 'Queen Size Bed', 'a queen bed', { features: ['Nile View', 'Balcony'], kitchen: 'kitchenette', washer: false, predicted: ['areaSqm'] }),
  u('prime-select-zamalek-central-standard-1-bdr-apt-city-view', 'Standard One Bedroom Apartment, City View', 1, 1, 45, 'Queen Size Bed', 'a queen bedroom and a living area', { features: ['City View'], kitchen: 'kitchenette', washer: false, predicted: ['areaSqm'] }),
  u('prime-select-zamalek-central-one-bedroom-apt', 'Superior One Bedroom Apartment, City View', 1, 1, 50, 'Twin Beds', 'a twin bedroom plus a queen bed in the living area', { features: ['City View'], kitchen: 'kitchenette', washer: false }),
  u('prime-select-zamalek-central-2-bdrs-nile-view', 'Two Bedroom Apartment with Two Balconies, Nile View', 2, 1, 90, 'Queen Size Bed', 'two queen bedrooms', { features: ['Nile View', 'Balcony'], kitchen: 'kitchenette', washer: false, predicted: ['areaSqm'] }),

  // Prime Select Gamet El Dewal (Dokki)
  u('prime-select-gamet-el-dewal-studio-apartment', 'Standard Studio', 0, 1, 55, 'Queen Size Bed', 'a queen bed'),
  u('prime-select-gamet-el-dewal-one-bedroom-apartment', 'One Bedroom Apartment with Balcony', 1, 1, 120, 'Queen Size Bed', 'a queen bedroom and a spacious living area', { features: ['Balcony'] }),

  // Prime Select Mall of Arabia / The Crown / New Giza / West Sodic
  u('prime-select-mall-of-arabia-two-bedrooms', 'Superior Two Bedroom Apartment with Balcony', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true, features: ['Balcony'], kitchen: 'american', nespresso: true }),
  u('prime-select-mall-of-arabia-2-bedrooms-apartment', 'Deluxe Two Bedroom Apartment with Balcony', 2, 2, 120, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true, features: ['Balcony'], kitchen: 'american', nespresso: true }),
  u('prime-select-the-crown-3-bedrooms-master', 'Three Bedroom Apartment with Garden and Nanny Room', 3, 3, 250, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom, a nanny room and a living area with sofa', { half: true, features: ['Private Garden', 'Balcony'] }),
  u('prime-select-new-giza-two-bedrooms-pyramids-view', 'Two Bedroom Apartment, Pyramids View', 2, 2, 175, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true, features: ['Pyramids View', 'Balcony'] }),
  u('prime-select-new-giza-two-bedrooms-with-garden', 'Two Bedroom Apartment with Garden', 2, 2, 175, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { half: true, features: ['Private Garden', 'Balcony'] }),
  u('prime-select-new-giza-three-bedrooms-penthouse', 'Three Bedroom Penthouse with Nanny Room', 3, 2, 180, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom, a nanny room and a living area with sofa', { half: true, features: ['Balcony'] }),
  u('prime-select-new-giza-3-bedrooms-apartment-with-roof', 'Three Bedroom Apartment with Roof', 3, 2, 238, 'King, Queen & Twin Beds', 'a king master suite with dressing room and terrace, a queen bedroom and a twin bedroom', { half: true, features: ['Rooftop', 'Terrace', 'Balcony'] }),
  u('prime-select-west-sodic-studio', 'Studio with Rooftop', 0, 1, 75, 'Queen Size Bed', 'a queen bed and a sofa', { features: ['Rooftop', 'Balcony'], predicted: ['areaSqm'] }),
  u('prime-select-west-sodic-2-bedroom-apartment', 'Duplex Two Bedroom Apartment', 2, 2, 250, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa over two levels', { half: true, features: ['Duplex', 'Balcony'] }),

  // Alexandria
  u('prime-select-san-stefano-alexandria-2-bedroom-apartment-sea-view', 'Two Bedroom Apartment, Sea View', 2, 2, 153, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a living area with sofa', { features: ['Sea View', 'Balcony'], nespresso: true }),
  u('prime-select-gleem-two-bedrooms-apartment', 'Two Bedroom Apartment, Sea View', 2, 1, 95, 'Queen & Twin Beds', 'a queen bedroom and a twin bedroom', { half: true, features: ['Sea View', 'Balcony'] }),
  u('prime-select-raml-station-alexandria-superior-two-bedrooms', 'Superior Two Bedroom Apartment with Balcony', 2, 1, 110, 'Queen Size Bed', 'a queen bedroom and a bedroom with three single beds', { features: ['Balcony'] }),
  u('prime-select-raml-station-alexandria-superior-three-bedrooms', 'Superior Three Bedroom Apartment with Balcony', 3, 1, 130, 'Queen & Twin Beds', 'a queen bedroom and two twin bedrooms', { half: true, features: ['Balcony'] }),

  // Prime Inn 10th of Ramadan
  u('prime-inn-10th-of-ramadan-queen-studio', 'Studio, Queen Bed', 0, 1, 50, 'Queen Size Bed', 'a queen bed'),
  u('prime-inn-10th-of-ramadan-twin-studio', 'Studio, Twin Beds', 0, 1, 50, 'Twin Beds', 'twin beds'),
  u('prime-inn-10th-of-ramadan-single-studio', 'Studio, Single Bed', 0, 1, 35, 'Single Bed', 'a single bed', { washer: false, extraAmenities: ['Mini Bar'] }),

  // Almanzel Sheikh Zayed (hotel-style studios)
  u('almanzel-sheikh-zayed-standard-room', 'Standard Studio, Twin Beds', 0, 1, 25, 'Twin Beds', 'twin beds', { kitchen: 'none', washer: false, tv: 'TV' }),
  u('almanzel-sheikh-zayed-superior-room', 'Superior Studio with Balcony, Twin Beds', 0, 1, 30, 'Twin Beds', 'twin beds and two chairs', { features: ['Balcony'], kitchen: 'none', washer: false, tv: 'TV' }),
  u('almanzel-sheikh-zayed-deluxe-room', 'Deluxe Studio with Pool-View Balcony, Twin Beds', 0, 1, 35, 'Twin Beds', 'twin beds and a sofa', { features: ['Pool View', 'Balcony'], kitchen: 'fridge', washer: false, tv: 'TV' }),

  // Prime Inn Andalus New Cairo
  u('prime-inn-andalus-new-cairo-hotel-room', 'Hotel Room, Queen Bed', 1, 1, 20, 'Queen Size Bed', 'a queen bed', { kitchen: 'none', washer: false, unitType: 'Studio' }),
  u('prime-inn-andalus-new-cairo-standard-studio', 'Standard Studio', 0, 1, 30, 'Queen Size Bed', 'a queen bed', { kitchen: 'kitchenette', washer: false, extraAmenities: ['Mini Bar'] }),
  u('prime-inn-andalus-new-cairo-superior-studio', 'Superior Studio', 0, 1, 35, 'Queen Size Bed', 'a queen bed', { kitchen: 'kitchenette' }),
  u('prime-inn-andalus-new-cairo-one-bedroom-apartment', 'One Bedroom Apartment', 1, 1, 35, 'Queen Size Bed', 'a queen bedroom', { kitchen: 'kitchenette' }),
  u('prime-inn-andalus-new-cairo-two-bedrooms-apartment', 'Two Bedroom Apartment', 2, 2, 60, 'Queen & Twin Beds', 'a queen bedroom, a twin bedroom and a sofa', { kitchen: 'kitchenette' }),

  // Prime Boutique (hotel rooms, Heliopolis)
  u('prime-boutique-standard-queen', 'Standard Room, Queen Bed', 1, 1, 25, 'Queen Size Bed', 'a queen bed', { kitchen: 'none', washer: false, unitType: 'Studio', extraAmenities: ['Mini Bar'] }),
  u('prime-boutique-standard-twin', 'Standard Room, Twin Beds', 1, 1, 25, 'Twin Beds', 'twin beds', { kitchen: 'none', washer: false, unitType: 'Studio', extraAmenities: ['Mini Bar'] }),
  u('prime-boutique-standard-triple', 'Standard Triple Room', 1, 1, 30, 'Triple Beds', 'three single beds', { kitchen: 'none', washer: false, unitType: 'Studio' }),
  u('prime-boutique-deluxe-queen', 'Deluxe Room, Queen Bed', 1, 1, 35, 'Queen Size Bed', 'a queen bed', { kitchen: 'none', washer: false, unitType: 'Studio', extraAmenities: ['Mini Bar'] }),
  u('prime-boutique-deluxe-twin', 'Deluxe Room, Twin Beds', 1, 1, 35, 'Twin Beds', 'twin beds', { kitchen: 'none', washer: false, unitType: 'Studio', extraAmenities: ['Mini Bar'] }),
  u('prime-boutique-suite', 'Suite, Queen Bed', 1, 1, 50, 'Queen Size Bed', 'a queen bed and a separate sitting area', { kitchen: 'none', washer: false, unitType: 'Studio', extraAmenities: ['Mini Bar'] }),

  // North Coast — Prime Holidays
  u('prime-holidays-mountain-viewras-elhekma-four-bedrooms-chalet', 'Four Bedroom Duplex Chalet with Garden', 4, 3, 165, 'Queen & Twin Beds', 'two queen master bedrooms and two twin bedrooms', { features: ['Private Garden', 'Balcony', 'Duplex'], beachNote: '10 minutes away by car' }),
  u('prime-holidays-mountain-viewras-elhekma-six-bedrooms-duplex', 'Six Bedroom Duplex Villa with Garden', 6, 3, 245, 'Queen & Twin Beds', 'queen and twin bedrooms across two floors, including a ground-floor queen bedroom', { features: ['Private Garden', 'Balcony', 'Duplex'], beachNote: 'just a 5-minute walk away' }),
  u('prime-holidays-cesar-bay-2-bedrooms-with-garden', 'Two Bedroom Chalet with Garden', 2, 2, 90, 'Queen & Twin Beds', 'a queen master bedroom and a twin bedroom', { features: ['Private Garden'] }),
  u('prime-holidays-cesar-bay-3-bedrooms-with-garden', 'Three Bedroom Chalet with Garden', 3, 2, 130, 'Queen & Twin Beds', 'two queen bedrooms and a twin bedroom', { features: ['Private Garden'] }),
  u('prime-holidays-cesar-bay-3-bedrooms', 'Three Bedroom Chalet with Rooftop', 3, 2, 130, 'Queen & Twin Beds', 'a queen master bedroom and two twin bedrooms', { features: ['Rooftop', 'Balcony'] }),
  u('prime-holidays-hacienda-bay-3-bedrooms-c10g', 'Three Bedroom Chalet with Garden and Nanny Room', 3, 2, 190, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a nanny room', { features: ['Private Garden'] }),
  u('prime-holidays-hacienda-bay-4-bedrooms-c10f', 'Four Bedroom Chalet with Rooftop Terrace', 4, 4, 240, 'Queen & Twin Beds', 'two queen master bedrooms and two twin bedrooms', { features: ['Rooftop'] }),
  u('prime-holidays-amwaj-two-bedrooms-with-garden-u-901', 'Two Bedroom Chalet with Garden', 2, 2, 90, 'Queen & Twin Beds', 'a queen master bedroom and a twin bedroom', { features: ['Private Garden'] }),
  u('prime-holidays-amwaj-3-bedrooms-duplex-f8-02', 'Three Bedroom Duplex Chalet with Garden', 3, 3, 200, 'Queen & Twin Beds', 'two queen master bedrooms, a twin bedroom, a nanny room and a driver room', { features: ['Private Garden', 'Duplex'] }),
  u('prime-holidays-amwaj-stand-alone-villa-beachfront', 'Beachfront Four Bedroom Villa', 4, 4, 275, 'Queen & Twin Beds', 'two queen master bedrooms, two twin bedrooms, a nanny room and a driver room', { features: ['Sea View', 'Beachfront'] }),
  u('prime-holidays-seashell-3-bedrooms-shell-01', 'Three Bedroom Chalet with Nanny Room', 3, 4, 200, 'Queen & Twin Beds', 'two queen bedrooms, a twin bedroom and a nanny room'),
  u('prime-holidays-seashell-4-bedrooms-dwelling-1412', 'Four Bedroom Chalet with Nanny Room, Dwelling 14/12', 4, 3, 250, 'Queen & Twin Beds', 'two queen master bedrooms, two twin bedrooms and a nanny room'),
  u('prime-holidays-seashell-4-bedrooms-dwelling-312', 'Four Bedroom Chalet with Nanny Room, Chalet 3/12', 4, 3, 250, 'Queen & Twin Beds', 'two queen master bedrooms, two twin bedrooms and a nanny room'),
];

module.exports = { PATCH_ID, PROPERTIES, UNITS };
