/**
 * Hotspot Data for Interactive Museum Exhibit
 * 
 * Each hotspot contains:
 * - id: Unique identifier
 * - side: 'front' or 'reverse' - which side of the artifact the hotspot appears on
 * - title: Display title for the curator panel
 * - polygon: Array of [x, y] coordinates defining the clickable region
 *            Coordinates are in the artifact's native coordinate space (viewBox)
 * - narrative: HTML content for the curator panel (1-2 paragraphs)
 * - link: { url: string, label: string } - External resource link
 * 
 * COORDINATE SYSTEM:
 * - Front side viewBox: 807 x 1024 (matches image dimensions)
 * - Reverse side viewBox: 807 x 1024 (matches card dimensions)
 * 
 * TO ADD A NEW HOTSPOT:
 * 1. Enable edit mode by adding ?edit=1 to the URL
 * 2. Click points on the image to log coordinates to the console
 * 3. Press 'C' to copy the polygon array, 'R' to reset points
 * 4. Add a new entry to the hotspots array below with the coordinates
 * 5. Test the hotspot placement and adjust as needed
 */

const hotspots = [
  // ===== FRONT SIDE HOTSPOTS =====
  {
    id: 'corbett-face',
    side: 'front',
    title: 'James J. "Gentleman Jim" Corbett',
    polygon: [[320, 95], [485, 95], [485, 250], [320, 250]],
    narrative: `
      <p>James John Corbett (1866–1933) revolutionized boxing with his scientific approach to the sport. 
      Unlike the bare-knuckle brawlers who preceded him, Corbett emphasized speed, footwork, and 
      strategic defense over brute strength. His elegant style earned him the nickname "Gentleman Jim."</p>
      <p>Born in San Francisco to Irish immigrant parents, Corbett worked as a bank clerk before 
      turning professional. On September 7, 1892, he shocked the sporting world by defeating the 
      seemingly invincible John L. Sullivan to claim the heavyweight championship—a title he would 
      hold until 1897.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/James_J._Corbett',
      label: 'Wikipedia: James J. Corbett'
    }
  },
  {
    id: 'boxing-stance',
    side: 'front',
    title: 'The Scientific Boxing Stance',
    polygon: [[250, 250], [550, 250], [550, 720], [250, 720]],
    narrative: `
      <p>This photograph captures Corbett in his characteristic fighting stance—upright, balanced, 
      with fists raised in the modern boxing position. This posture represents the "scientific" 
      approach to boxing that Corbett pioneered, emphasizing defense and counter-punching over 
      aggressive slugging.</p>
      <p>Corbett trained extensively at the Olympic Athletic Club in San Francisco, where he 
      developed his signature style under coach Walter Watson. His method relied on superior 
      conditioning, precise footwork, and the ability to slip punches while delivering sharp, 
      accurate combinations.</p>
    `,
    link: {
      url: 'https://www.britannica.com/sports/boxing',
      label: 'Britannica: History of Boxing'
    }
  },
  {
    id: 'cabinet-mount',
    side: 'front',
    title: 'The Cabinet Card Format',
    polygon: [[50, 850], [755, 850], [755, 1010], [50, 1010]],
    narrative: `
      <p>This photograph is mounted on a cabinet card—the dominant portrait format of the 1880s 
      and 1890s. Measuring approximately 4¼ × 6½ inches, cabinet cards replaced the smaller 
      carte de visite and became the standard for celebrity portraits, family photographs, and 
      commercial imagery.</p>
      <p>The thick cardboard mount protected the delicate albumen or collodion print while 
      providing space for the photographer's imprint. Cabinet cards were designed for display 
      in Victorian parlors, often arranged in special albums or displayed on mantlepieces.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/Cabinet_card',
      label: 'Wikipedia: Cabinet Card'
    }
  },

  // ===== REVERSE SIDE HOTSPOTS =====
  {
    id: 'chickering-studio',
    side: 'reverse',
    title: 'Elmer Chickering\'s Royal Studio',
    polygon: [[280,67],[527,67],[527,98],[280,98]],
    narrative: `
      <p>Elmer Chickering operated "The Royal Studio" at 21 West Street in Boston, one of the 
      city's premier portrait establishments in the 1890s. His studio became the destination 
      for celebrities, politicians, and society figures seeking high-quality cabinet card 
      portraits.</p>
      <p>Chickering's client list reads like a who's who of Gilded Age America: he photographed 
      Princess Kaiulani of Hawaii, actress Margaret Mather, the Boston Beaneaters baseball team, 
      and numerous Massachusetts legislators. His Corbett portraits helped cement the boxer's 
      image as a refined gentleman athlete.</p>
    `,
    link: {
      url: 'https://www.loc.gov/pictures/search/?q=chickering&co=pga',
      label: 'Library of Congress: Chickering Photographs'
    }
  },
  {
    id: 'boston-address',
    side: 'reverse',
    title: '21 West Street, Boston',
    polygon: [[262,163],[545,163],[545,183],[262,183]],
    narrative: `
      <p>West Street in downtown Boston was a fashionable commercial district in the 1890s, 
      home to photographers, booksellers, and upscale retail establishments. Chickering's 
      choice of this prestigious address reflected his status as one of Boston's leading 
      portrait photographers.</p>
      <p>The neighborhood was within easy reach of Boston's theater district and major 
      hotels, making it convenient for visiting celebrities and touring performers to 
      sit for portraits during their engagements in the city.</p>
    `,
    link: {
      url: 'https://www.digitalcommonwealth.org/',
      label: 'Digital Commonwealth: Boston History'
    }
  },
  {
    id: 'copyright-notice',
    side: 'reverse',
    title: 'Copyright Protection in 1896',
    polygon: [[329,939],[478,939],[478,959],[329,959]],
    narrative: `
      <p>The copyright notice "Copyright by E. Chickering" reflects the growing importance 
      of intellectual property protection for photographers in the 1890s. Following the 
      landmark Supreme Court case Burrow-Giles Lithographic Co. v. Sarony (1884), photographs 
      were definitively recognized as protected creative works.</p>
      <p>Celebrity portraits were valuable commercial properties. Unauthorized reproductions 
      could be sold as postcards, trade cards, or newspaper illustrations, making copyright 
      registration essential for professional photographers.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/Burrow-Giles_Lithographic_Co._v._Sarony',
      label: 'Wikipedia: Burrow-Giles v. Sarony'
    }
  },
  {
    id: 'sullivan-defeat',
    side: 'reverse',
    title: 'The Sullivan-Corbett Championship',
    polygon: [[329,378],[417,378],[417,399],[329,399]],
    narrative: `
      <p>The biographical text references Corbett's historic victory over John L. Sullivan 
      on September 7, 1892, in New Orleans. This was the first heavyweight championship 
      bout fought under Queensberry Rules with padded gloves, marking the transition from 
      bare-knuckle prizefighting to modern boxing.</p>
      <p>Sullivan, "The Boston Strong Boy," had been champion for a decade and was considered 
      invincible. Corbett's 21st-round knockout shocked the nation and announced the arrival 
      of a new era in professional boxing.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/John_L._Sullivan',
      label: 'Wikipedia: John L. Sullivan'
    }
  },
  {
    id: 'queensberry-rules',
    side: 'reverse',
    title: 'Marquess of Queensberry Rules',
    polygon: [[482,400],[588,400],[588,421],[482,421]],
    narrative: `
      <p>The text mentions the "Queensberry Rules," the standardized boxing regulations 
      published in 1867 under the patronage of John Douglas, 9th Marquess of Queensberry. 
      These rules mandated padded gloves, three-minute rounds with one-minute rest periods, 
      and a ten-second count for knockdowns.</p>
      <p>Corbett was the first heavyweight champion crowned under these rules, which 
      transformed boxing from a brutal, often illegal spectacle into a regulated sport 
      that could be held in legitimate venues and reported in mainstream newspapers.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/Marquess_of_Queensberry_Rules',
      label: 'Wikipedia: Queensberry Rules'
    }
  },
  {
    id: 'olympic-club',
    side: 'reverse',
    title: 'The Olympic Athletic Club',
    polygon: [[448,512],[565,512],[565,533],[448,533]],
    narrative: `
      <p>Corbett honed his skills at the Olympic Athletic Club in San Francisco, one of 
      the premier sporting establishments on the West Coast. Founded in 1860, the club 
      provided facilities for boxing, wrestling, fencing, and gymnastics.</p>
      <p>Under the guidance of boxing instructor Walter Watson, Corbett developed from 
      a talented amateur into a polished professional. He served as the club's boxing 
      instructor while working his way up through the heavyweight ranks.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/Olympic_Club_(San_Francisco)',
      label: 'Wikipedia: Olympic Club'
    }
  },
  {
    id: 'billy-brady',
    side: 'reverse',
    title: 'William A. Brady, Manager',
    polygon: [[329,490],[420,490],[420,511],[329,511]],
    narrative: `
      <p>William A. Brady (1863–1950) was Corbett's manager and theatrical promoter. 
      A theatrical impresario, Brady recognized Corbett's potential both in the ring 
      and on stage.</p>
      <p>Brady transformed Corbett into America's first modern sports celebrity, arranging 
      boxing exhibitions, theatrical tours, and lucrative endorsement deals. After Corbett's 
      boxing career, Brady became one of Broadway's most successful producers.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/William_A._Brady',
      label: 'Wikipedia: William A. Brady'
    }
  },
  {
    id: 'chickering-name',
    side: 'reverse',
    title: 'Elmer Chickering, Photographer',
    polygon: [[320,117],[425,117],[425,139],[320,139]],
    narrative: `
      <p>Elmer Chickering was one of Boston's most prominent portrait photographers in the 
      1890s. Operating from his studio at 21 West Street, he specialized in cabinet card 
      portraits of celebrities, politicians, and notable figures.</p>
      <p>His clientele included Princess Kaiulani of Hawaii, actress Margaret Mather, 
      members of the Massachusetts General Court, and the Boston Beaneaters baseball team. 
      Chickering's portraits were known for their quality and artistic composition.</p>
    `,
    link: {
      url: 'https://www.loc.gov/pictures/search/?q=chickering&co=pga',
      label: 'Library of Congress: Chickering Photographs'
    }
  },
  {
    id: 'walter-watson',
    side: 'reverse',
    title: 'Walter Watson, Boxing Instructor',
    polygon: [[312,534],[394,534],[394,555],[312,555]],
    narrative: `
      <p>Walter Watson served as the boxing instructor at the Olympic Athletic Club in 
      San Francisco, where he trained a young James Corbett. Under Watson's guidance, 
      Corbett developed the scientific boxing style that would make him famous.</p>
      <p>Watson emphasized footwork, timing, and defensive technique over brute force—
      principles that Corbett would later use to defeat the seemingly invincible 
      John L. Sullivan and usher in the modern era of boxing.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/Olympic_Club_(San_Francisco)',
      label: 'Wikipedia: Olympic Club'
    }
  },
  {
    id: 'joe-corbett',
    side: 'reverse',
    title: 'Joseph Corbett, Baseball Pitcher',
    polygon: [[213,602],[298,602],[298,623],[213,623]],
    narrative: `
      <p>Joseph Corbett (1875–1945) was James Corbett's younger brother and a professional 
      baseball pitcher. He played in the major leagues from 1895 to 1904, most notably 
      for the Baltimore Orioles.</p>
      <p>In 1897, Joe Corbett won 24 games for the Orioles, one of the dominant teams 
      of the era. The Corbett brothers occasionally appeared together in exhibition 
      baseball games, combining their athletic talents for promotional events.</p>
    `,
    link: {
      url: 'https://sabr.org/bioproj/person/joe-corbett/',
      label: 'SABR: Joe Corbett Biography'
    }
  },
  {
    id: 'baltimore-orioles',
    side: 'reverse',
    title: 'Baltimore Orioles (1890s)',
    polygon: [[567,602],[663,602],[663,623],[567,623]],
    narrative: `
      <p>The Baltimore Orioles of the 1890s were one of baseball's most successful and 
      innovative teams. Winners of three consecutive National League pennants (1894–1896), 
      they pioneered aggressive tactics like the hit-and-run play and the Baltimore chop.</p>
      <p>Managed by Ned Hanlon, the team featured future Hall of Famers including John McGraw, 
      Hughie Jennings, and Willie Keeler. Joe Corbett joined this championship roster 
      in 1896, contributing to their continued success.</p>
    `,
    link: {
      url: 'https://en.wikipedia.org/wiki/History_of_the_Baltimore_Orioles_(1882%E2%80%931899)',
      label: 'Wikipedia: Baltimore Orioles History'
    }
  }
];

// Export for use in main application
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { hotspots };
}
