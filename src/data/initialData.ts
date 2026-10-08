import { Article, Category, Comment, NewsSource, AutomationLog, SiteSettings } from '../types';

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat-world',
    slug: 'world',
    sortOrder: 1,
    isVisible: true,
    inNavigation: true,
    color: '#0284C7',
    iconName: 'Globe',
    names: {
      en: 'World',
      ar: 'شؤون العالم',
      de: 'Welt',
      es: 'Mundo',
      fr: 'Monde',
    },
    descriptions: {
      en: 'International diplomacy, global summits, geopolitics, and multilateral developments.',
      ar: 'تغطيات الدبلوماسية الدولية والقمم العالمية والجيوسياسية والتطورات متعددة الأطراف.',
      de: 'Internationale Diplomatie, Weltgipfel, Geopolitik und multilaterale Verträge.',
      es: 'Diplomacia internacional, cumbres mundiales, geopolítica y acuerdos multilaterales.',
      fr: 'Diplomatie internationale, sommets mondiaux, géopolitique et accords multilatéraux.',
    },
  },
  {
    id: 'cat-politics',
    slug: 'politics',
    sortOrder: 2,
    isVisible: true,
    inNavigation: true,
    color: '#475569',
    iconName: 'Building2',
    names: {
      en: 'Politics',
      ar: 'سياسة',
      de: 'Politik',
      es: 'Política',
      fr: 'Politique',
    },
    descriptions: {
      en: 'Elections, legislative milestones, governance reforms, and strategic statecraft.',
      ar: 'الانتخابات والمشاريع التشريعية وإصلاحات الحوكمة والقرارات الاستراتيجية للدول.',
      de: 'Wahlen, Gesetzgebung, Regierungsführung und strategische Staatspolitik.',
      es: 'Elecciones, reformas legislativas, gobernanza y estrategia estatal.',
      fr: 'Élections, réformes législatives, gouvernance et stratégies d’État.',
    },
  },
  {
    id: 'cat-economy',
    slug: 'economy',
    sortOrder: 3,
    isVisible: true,
    inNavigation: true,
    color: '#0D9488',
    iconName: 'TrendingUp',
    names: {
      en: 'Economy',
      ar: 'اقتصاد',
      de: 'Wirtschaft',
      es: 'Economía',
      fr: 'Économie',
    },
    descriptions: {
      en: 'Central banking, global financial markets, energy transition, and trade corridors.',
      ar: 'سياسات البنوك المركزية والأسواق المالية العالمية وتحولات الطاقة وممرات التجارة.',
      de: 'Zentralbankpolitik, globale Finanzmärkte, Energiewende und Handelsströme.',
      es: 'Bancos centrales, mercados financieros, transición energética y corredores comerciales.',
      fr: 'Banques centrales, marchés financiers mondiaux, transition énergétique et commerce.',
    },
  },
  {
    id: 'cat-technology',
    slug: 'technology',
    sortOrder: 4,
    isVisible: true,
    inNavigation: true,
    color: '#6366F1',
    iconName: 'Cpu',
    names: {
      en: 'Technology',
      ar: 'تكنولوجيا',
      de: 'Technologie',
      es: 'Tecnología',
      fr: 'Technologie',
    },
    descriptions: {
      en: 'Artificial intelligence governance, semiconductors, space exploration, and cyber defense.',
      ar: 'حوكمة الذكاء الاصطناعي وصناعة الرقائق واستكشاف الفضاء والدفاع السيبراني.',
      de: 'KI-Regulierung, Halbleiter, Raumfahrt und Cybersicherheit.',
      es: 'Gobernanza de IA, semiconductores, exploración espacial y ciberseguridad.',
      fr: 'Régulation de l’IA, semi-conducteurs, exploration spatiale et cybersécurité.',
    },
  },
  {
    id: 'cat-sports',
    slug: 'sports',
    sortOrder: 5,
    isVisible: true,
    inNavigation: true,
    color: '#E11D48',
    iconName: 'Trophy',
    names: {
      en: 'Sports',
      ar: 'رياضة',
      de: 'Sport',
      es: 'Deportes',
      fr: 'Sports',
    },
    descriptions: {
      en: 'Global tournaments, Olympic preparations, football championships, and athletic excellence.',
      ar: 'البطولات العالمية والاستعدادات الأولمبية وكرة القدم والإنجازات الرياضية الدولية.',
      de: 'Internationale Turniere, Olympia-Vorbereitungen, Fußball und sportliche Höchstleistungen.',
      es: 'Torneos internacionales, olimpiadas, ligas de fútbol y alta competición.',
      fr: 'Compétitions internationales, préparations olympiques, football et grands chelems.',
    },
  },
  {
    id: 'cat-health',
    slug: 'health',
    sortOrder: 6,
    isVisible: true,
    inNavigation: true,
    color: '#059669',
    iconName: 'Activity',
    names: {
      en: 'Health',
      ar: 'صحة',
      de: 'Gesundheit',
      es: 'Salud',
      fr: 'Santé',
    },
    descriptions: {
      en: 'Epidemiological surveillance, medical breakthroughs, public health systems, and longevity.',
      ar: 'الرصد الوبائي والابتكارات الطبية وأنظمة الرعاية الصحية العامة والدراسات السريرية.',
      de: 'Epidemiologie, medizinische Innovationen, Gesundheitssysteme und Forschung.',
      es: 'Vigilancia epidemiológica, avances médicos y sistemas públicos de salud.',
      fr: 'Surveillance épidémiologique, innovations médicales et santé publique.',
    },
  },
  {
    id: 'cat-culture',
    slug: 'culture',
    sortOrder: 7,
    isVisible: true,
    inNavigation: true,
    color: '#D97706',
    iconName: 'Palette',
    names: {
      en: 'Culture',
      ar: 'ثقافة',
      de: 'Kultur',
      es: 'Cultura',
      fr: 'Culture',
    },
    descriptions: {
      en: 'Heritage preservation, architecture, literature, cinematic arts, and cross-cultural dialogue.',
      ar: 'حماية التراث المعماري والأدب والفنون السينمائية والحوار الحضاري بين الشعوب.',
      de: 'Denkmalschutz, Architektur, Literatur, Filmkunst und interkultureller Dialog.',
      es: 'Patrimonio histórico, arquitectura, literatura, cine y diálogo intercultural.',
      fr: 'Préservation du patrimoine, architecture, littérature, cinéma et dialogue des cultures.',
    },
  },
];

export const INITIAL_ARTICLES: Article[] = [
  {
    id: 'art-001',
    category: 'world',
    editorialType: 'original',
    originalSource: 'United Nations Climate Information Service & UN News',
    originalUrl: 'https://news.un.org/en/story/2024/03/1147746',
    image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1400&q=80',
    imageCredit: 'Elena Rostova / World News Editorial Bureau Pool',
    imageProvenance: 'Editorial staff photograph, Palais des Nations press briefing',
    imageLicense: 'World News Copyright Reserved © 2026',
    status: 'published',
    isBreaking: true,
    isPinned: true,
    priority: 10,
    views: 42180,
    shares: 3420,
    publishedAt: '2026-09-21T08:30:00Z',
    updatedAt: '2026-09-21T10:15:00Z',
    byline: 'Marcus Vance & Farida Al-Husseini',
    hasVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=0Puv0Pss33M',
    videoIframeUrl: 'https://www.youtube.com/embed/0Puv0Pss33M?autoplay=0&rel=0&modestbranding=1',
    videoThumbnail: 'https://img.youtube.com/vi/0Puv0Pss33M/maxresdefault.jpg',
    translations: {
      en: {
        language: 'en',
        title: 'Geneva Climate Summit Concludes With Historic Cross-Continental Grid Accord',
        slug: 'geneva-climate-summit-grid-accord',
        executiveSummary: 'Delegates from 64 nations ratified the Geneva Trans-Continental Clean Power Accord, pledging $380 billion in unified HVDC interconnector infrastructure by 2032. The multilateral framework creates binding mechanisms for cross-border solar and offshore wind energy distribution.',
        structuredBody: `## A Multilateral Breakthrough After 14 Days of Intensive Talks

Negotiators at the Palais des Nations in Geneva concluded a fortnight of round-the-clock negotiations this morning, formalizing what diplomatic observers consider the most concrete infrastructure agreement since the 2015 Paris Accord.

The **Trans-Continental Clean Power Protocol (TCCPP)** establishes a shared financing clearinghouse for high-voltage direct current (HVDC) transmission lines connecting North African solar generation facilities with European manufacturing centers, alongside reciprocal interconnectors across Central Asia.

### Key Treaty Provisions

1. **Capital Mobilization:** Initial public-private funding pool of $380 billion guaranteed across four international development banks.
2. **Standardized Technical Interoperability:** A universal frequency and digital telemetry baseline to prevent cascading disruptions.
3. **Equitable Transmission Tariffs:** Low-income transit nations retain capped sovereign wheeling revenues to fund domestic rural electrification.

> "Energy security in the twenty-first century is not defined by storage silos, but by transmission resilience," declared Chief Envoy Helene Berg during the formal signing ceremony.

### Strategic Implications for Developing Economies

Unlike prior accords that emphasized aspirational emissions targets without capital deployment guarantees, the Geneva framework binds signatories to construction milestones beginning in the second quarter of 2027. Developing economies represent 42% of the initial oversight board, ensuring tariff autonomy.`,
        seoTitle: 'Geneva Climate Summit: Historic $380B Clean Power Grid Accord Ratified',
        metaDescription: '64 nations sign the Geneva Trans-Continental Clean Power Protocol in Switzerland, establishing unified HVDC interconnectors and financing mechanisms.',
        keywords: ['Geneva Summit', 'Clean Energy Accord', 'HVDC Interconnector', 'Renewable Infrastructure', 'Climate Diplomacy'],
        imageAlt: 'Diplomats gather at the Palais des Nations conference hall in Geneva during the plenary accord signing.',
        faq: [
          {
            question: 'When will construction on the first trans-continental lines begin?',
            answer: 'Under Section 4 of the protocol, site surveys and procurement tenders open in Q2 2027, with the first Mediterranean subsea corridor scheduled for commissioning by late 2029.',
          },
          {
            question: 'How is sovereign grid ownership protected under the agreement?',
            answer: 'Each signatory nation maintains 100% legal ownership over physical infrastructure situated within its territorial boundaries and exclusive economic zones.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Geneva', 'Palais des Nations', 'HVDC Transmission', 'Helene Berg', 'United Nations'],
        corrections: 'Clarified in paragraph 3 that Central Asian lines form Phase II of the interconnector sequence.',
      },
      ar: {
        language: 'ar',
        title: 'قمة جنيف للمناخ تختتم أعمالها باتفاق تاريخي لربط شبكات الطاقة النظيفة بين القارات',
        slug: 'geneva-climate-summit-grid-accord-ar',
        executiveSummary: 'صادق وفود 64 دولة في جنيف على بروتوكول تاريخي لإنشاء شبكات ربط كهربائي عابرة للقارات بقيمة 380 مليار دولار بحلول عام 2032. ويضع الاتفاق آليات ملزمة لتبادل الطاقة الشمسية وطاقة الرياح البحرية عبر ممرات نقل فائقة القدرة.',
        structuredBody: `## انفراجة دبلوماسية متعددة الأطراف بعد أسبوعين من المفاوضات الشاقة

اختتم المفاوضون في قصر الأمم بجنيف صباح اليوم أسبوعين من المشاورات الماراثونية المتواصلة، بإقرار اتفاقية الربط الكهربائي العابر للقارات، والتي وصفها المراقبون بأنها الخطوة التنفيذية الأهم منذ اتفاق باريس.

ويركز البروتوكول الموقع على تمويل وتشييد خطوط نقل التيار المباشر عالي الجهد (HVDC) التي تربط محطات الطاقة الشمسية الكبرى في شمال إفريقيا والشرق الأوسط بالمراكز الصناعية الأوروبية، مع التوسع نحو آسيا الوسطى في مراحل لاحقة.

### أبرز بنود الاتفاقية الدولية

1. **حشد الاستثمارات التنموية:** توفير حزمة تمويل أولية بقيمة 380 مليار دولار تضمنها أربعة بنوك تنمية دولية.
2. **المعايير التقنية الموحدة:** اعتماد بروتوكولات قياس ومزامنة رقمية موحدة لحماية الشبكات المشتركة من الانقطاعات الطارئة.
3. **حماية السيادة وعائدات العبور:** ضمان حقوق الدول النامية ودول العبور في عوائد نقل الطاقة واستثمار جزء منها في كهربة الريف.

> وأكدت المبعوثة الأممية هيلين بيرغ خلال المؤتمر الصحفي الختامي: "إن أمن الطاقة في القرن الحادي والعشرين لم يعد يُقاس بحجم المخزونات، بل بمرونة شبكات النقل العابرة للحدود".

### مكاسب استراتيجية للدول النامية

بخلاف القمم السابقة التي اكتفت بوعود خفض الانبعاثات النظرية، يلزم بروتوكول جنيف الدول الموقعة بجدول زمني صارم لبدء الأعمال الهندسية بحلول الربع الثاني من عام 2027، مع تمثيل متوازن للدول النامية في مجلس الحوكمة بنسبة 42%.`,
        seoTitle: 'قمة جنيف: إقرار اتفاق تاريخي لربط شبكات الطاقة النظيفة بقيمة 380 مليار دولار',
        metaDescription: '64 دولة توقع في جنيف اتفاقية الربط الكهربائي القاري للتيار المباشر عالي الجهد لدعم نقل الطاقة المتجددة بحلول 2032.',
        keywords: ['قمة جنيف', 'الطاقة النظيفة', 'الربط الكهربائي الدولي', 'قصر الأمم', 'دبلوماسية المناخ'],
        imageAlt: 'وفود الدول المشاركة في قاعة المؤتمرات بقصر الأمم بجنيف أثناء جلسة التوقيع الرسمية.',
        faq: [
          {
            question: 'متى تنطلق أعمال التشييد للمرحلة الأولى من المشروع؟',
            answer: 'تنص المادة الرابعة من البروتوكول على طرح المناقصات الميدانية في الربع الثاني من 2027، مع استهداف تشغيل خط الربط البحري بالمتوسط أواخر 2029.',
          },
          {
            question: 'كيف يضمن الاتفاق سيادة الدول على شبكاتها المحلية؟',
            answer: 'يحتفظ كل بلد مشارك بالملكية القانونية الكاملة والتشغيل السيادي للبنية التحتية الواقعة داخل حدوده الجغرافية ومياهه الاقتصادية الخالصة.',
          },
        ],
        translationStatus: 'complete',
        entities: ['جنيف', 'قصر الأمم', 'التيار المباشر عالي الجهد', 'الأمم المتحدة'],
      },
      de: {
        language: 'de',
        title: 'Genfer Klimagipfel endet mit historischem Abkommen über transkontinentale Stromnetze',
        slug: 'genfer-klimagipfel-stromnetz-abkommen',
        executiveSummary: 'Delegierte aus 64 Staaten haben in Genf ein richtungsweisendes Abkommen über 380 Milliarden US-Dollar zur Vernetzung kontinentaler Ökostromnetze ratifiziert. Der Vertrag sieht verbindliche HGÜ-Trassen zwischen Nordafrika und Europa bis 2032 vor.',
        structuredBody: `## Durchbruch nach 14-tägigen Verhandlungen im Genfer Völkerbundpalast

Die internationalen Delegationen haben im Palais des Nations eine Vereinbarung über die künftige Energiearchitektur unterzeichnet. Das Abkommen schafft eine gemeinsame Finanzierungs- und Betriebsbasis für transkontinentale Gleichstrom-Verbindungen.

### Wesentliche Eckpunkte

1. **380 Milliarden US-Dollar Investitionsvolumen**, getragen von multilateralen Förderbanken und institutionellen Konsortien.
2. **Gemeinsame Betriebsstandards**, um Netzstabilität und Frequenzsicherheit bei stark schwankender Einspeisung zu garantieren.
3. **Faire Durchleitungsgebühren** für Transitländer zur Stärkung der heimischen Infrastruktur.`,
        seoTitle: 'Genfer Klimagipfel: 380-Milliarden-Dollar-Netzabkommen verabschiedet',
        metaDescription: '64 Staaten beschließen in Genf das Abkommen über kontinentale Ökostromnetze mit HGÜ-Trassen bis 2032.',
        keywords: ['Genfer Gipfel', 'Ökostrom', 'HGÜ Trassen', 'Energiewende', 'Klimadiplomatie'],
        imageAlt: 'Abschlussplenum im Palais des Nations in Genf.',
        faq: [
          {
            question: 'Wann beginnen die Baumaßnahmen?',
            answer: 'Die ersten Ausschreibungen starten im zweiten Quartal 2027, die Fertigstellung des ersten Mittelmeerkabels ist für Ende 2029 geplant.',
          },
          {
            question: 'Wer besitzt die Leitungen?',
            answer: 'Die jeweiligen Nationalstaaten behalten die uneingeschränkte Eigentümerschaft und Hoheit über Trassen auf ihrem Staatsgebiet.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Genf', 'Palais des Nations', 'HGÜ', 'Klimaschutz'],
      },
      es: {
        language: 'es',
        title: 'La Cumbre de Ginebra concluye con un pacto histórico para interconectar redes limpias',
        slug: 'cumbre-ginebra-redes-electricas-pacto',
        executiveSummary: 'Representantes de 64 naciones ratificaron en Ginebra el protocolo de interconexión eléctrica limpia por valor de 380.000 millones de dólares para 2032. El marco creará corredores de alta tensión continua entre continentes.',
        structuredBody: `## Acuerdo multilateral tras dos semanas de intensas negociaciones en Suiza

La cumbre climática celebrada en el Palacio de las Naciones de Ginebra culminó hoy con la firma de un ambicioso plan de interconexión energética. El acuerdo facilitará el flujo de energía solar y eólica marina entre regiones con altos índices de generación y zonas de gran demanda industrial.

### Pilares del tratado

1. **Fondo de inversión de 380.000 millones de dólares** garantizado por bancos multilaterales de desarrollo.
2. **Estándares técnicos y de ciberseguridad unificados** para prevenir contingencias en cascada.
3. **Tarifas de peaje reguladas** para proteger la soberanía energética de los países de tránsito.`,
        seoTitle: 'Cumbre de Ginebra: Histórico pacto de 380.000 millones para redes eléctricas limpias',
        metaDescription: '64 países ratifican en Ginebra el acuerdo de redes eléctricas de corriente continua para conectar la energía renovable continental.',
        keywords: ['Cumbre de Ginebra', 'Redes Eléctricas', 'Energía Renovable', 'Transición Ecológica'],
        imageAlt: 'Delegados diplomáticos reunidos en el Palacio de las Naciones de Ginebra.',
        faq: [
          {
            question: '¿Cuándo empezarán las obras?',
            answer: 'Las licitaciones técnicas darán comienzo en el segundo trimestre de 2027 y el primer tendido submarino operará en 2029.',
          },
          {
            question: '¿Quién controlará las infraestructuras?',
            answer: 'Cada estado firmante conservará la titularidad soberana de los tramos que discurran por su territorio nacional.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Ginebra', 'Palacio de las Naciones', 'Energías Limpias'],
      },
      fr: {
        language: 'fr',
        title: 'Sommet de Genève : Accord historique pour un réseau transcontinental d’énergie propre',
        slug: 'sommet-geneve-accord-reseau-electrique',
        executiveSummary: 'Les délégués de 64 pays ont ratifié à Genève un protocole d’interconnexion électrique de 380 milliards de dollars d’ici 2032. Ce traité structurel accélère le déploiement de lignes à haute tension continue entre l’Afrique du Nord et l’Europe.',
        structuredBody: `## Percée multilatérale majeure au Palais des Nations à Genève

Après 14 jours de négociations ininterrompues, les représentants de 64 pays ont validé le Protocole transcontinental d’électricité décarbonée. Ce texte engage les États signataires dans la création de corridors de transport électrique haute tension en courant continu (HVDC).

### Grands engagements du protocole

1. **Mobilisation de 380 milliards de dollars** d’investissements garantis par les banques internationales de développement.
2. **Harmonisation des protocoles télémétriques et de sécurité réseau** pour éviter toute déstabilisation des fréquences.
3. **Péages de transit régulés**, garantissant des retombées directes pour les pays émergents participant aux tracés.`,
        seoTitle: 'Sommet de Genève : Accord historique de 380 milliards pour les réseaux d’énergie propre',
        metaDescription: '64 pays signent au Palais des Nations à Genève un traité pour financer les autoroutes électriques transcontinentales d’ici 2032.',
        keywords: ['Sommet de Genève', 'Réseaux électriques', 'HVDC', 'Énergie renouvelable', 'Climat'],
        imageAlt: 'Séance plénière de signature au Palais des Nations à Genève.',
        faq: [
          {
            question: 'Quel est le calendrier des chantiers ?',
            answer: 'Les appels d’offres seront lancés au 2e trimestre 2027, avec une mise en service du premier câble transméditerranéen visée fin 2029.',
          },
          {
            question: 'La souveraineté des réseaux est-elle garantie ?',
            answer: 'Chaque État conserve la pleine propriété juridique et opérationnelle des tronçons situés sur son territoire souverain.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Genève', 'Palais des Nations', 'HVDC', 'Énergie propre'],
      },
    },
  },
  {
    id: 'art-002',
    category: 'economy',
    editorialType: 'ai-assisted',
    originalSource: 'Bank for International Settlements (BIS) / Reuters Global Finance',
    originalUrl: 'https://www.bis.org/about/bisih/topics/cbdc.htm',
    image: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Central Banking Observatory / Wire Pool',
    imageProvenance: 'Financial district trading floor, Frankfurt Stock Exchange',
    imageLicense: 'Editorial wire licensing partner terms',
    status: 'published',
    isBreaking: false,
    isPinned: true,
    priority: 9,
    views: 31400,
    shares: 1890,
    publishedAt: '2026-09-21T07:15:00Z',
    updatedAt: '2026-09-21T09:40:00Z',
    byline: 'Arthur Chen & Alistair Ross',
    translations: {
      en: {
        language: 'en',
        title: 'Central Banks Harmonize Cross-Border Wholesale Digital Currency Protocols',
        slug: 'central-banks-wholesale-digital-currency-protocols',
        executiveSummary: 'Eight major central monetary authorities completed interoperability testing for multi-currency wholesale digital settlement platforms. The initiative cuts international trade settlement latency from three days to under forty seconds.',
        structuredBody: `## Frictionless Cross-Border Clearing Moves From Pilot to Production

In a synchronized policy communiqué issued simultaneously from Tokyo, Frankfurt, London, and Singapore, eight central monetary authorities unveiled the technical specifications for Project Horizon, an automated multi-currency cross-border wholesale ledger.

Commercial lenders participating in the pilot reported an 87% reduction in counterparty collateral requirements and near-instantaneous liquidity balancing across contrasting time zones.

### Institutional Safeguards

* **Zero Speculative Volatility:** Tokens correspond strictly to sovereign central bank reserves held in segregated escrow accounts.
* **Granular Privacy Architecture:** Zero-knowledge cryptographic proofs protect trade confidentiality while retaining anti-money laundering auditability.
* **Resilience Redundancy:** Operations continue offline across local clusters during major undersea fiber anomalies.`,
        seoTitle: 'Central Banks Unveil Wholesale Digital Settlement Platform Project Horizon',
        metaDescription: 'Eight leading central banks standardize cross-border wholesale digital currency clearance, reducing trade settlement times to under 40 seconds.',
        keywords: ['Central Banking', 'Wholesale CBDC', 'Project Horizon', 'Global Trade Settlement', 'Financial Technology'],
        imageAlt: 'Stock market tickers and liquidity charts on trading terminals in Frankfurt.',
        faq: [
          {
            question: 'Does this initiative affect retail bank depositors?',
            answer: 'No. Project Horizon is exclusively designed for wholesale interbank clearing and sovereign debt settlements, not consumer retail accounts.',
          },
          {
            question: 'Which currencies are included in the initial release?',
            answer: 'The launch architecture supports transactions in EUR, JPY, GBP, SGD, CHF, CAD, and AUD, with additional emerging market currencies slated for 2027.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Project Horizon', 'Bank of England', 'ECB', 'Monetary Authority of Singapore'],
      },
      ar: {
        language: 'ar',
        title: 'البنوك المركزية الكبرى تطلق معايير موحدة لتسوية العملات الرقمية بين البنوك',
        slug: 'central-banks-wholesale-digital-currency-protocols-ar',
        executiveSummary: 'أعلنت ثماني سلطات نقدية عالمية استكمال الاختبارات الفنية لمنظومة التسوية الرقمية المشتركة بين البنوك للمدفوعات عبر الحدود. وتخفض المنظومة زمن تسوية التجارة الدولية من ثلاثة أيام إلى أقل من أربعين ثانية.',
        structuredBody: `## نقلة نوعية في كفاءة المعاملات المالية الدولية

في بيان مشترك صدر بالتزامن من فرانكفورت ولندن وطوكيو وسنغافورة، كشفت ثمانية بنوك مركزية كبرى عن المعايير التشغيلية لمشروع "هورايزون" للتسوية النقدية الرقمية الفورية بين المؤسسات المصرفية.

وأظهرت الاختبارات التجريبية تقليص متطلبات السيولة الاحتياطية بنسبة 87%، إلى جانب القضاء على مخاطر فروق التوقيت بين المراكز المالية الكبرى.

### الضمانات الرقابية والأمنية

* **تغطية نقدية كاملة:** كافة الوحدات الرقمية مدعومة بنسبة 100% باحتياطيات سيادية مودعة لدى البنوك المركزية المعنية.
* **حماية سرية الصفقات:** استخدام تقنيات البراهين الصفرية لتأمين بيانات الشركات التجارية مع ضمان الامتثال لمعايير مكافحة غسل الأموال.
* **استمرارية العمل دون انقطاع:** تصميم المنظومة للعمل بكفاءة حتى في حالات انقطاع الكابلات البحرية أو اضطرابات الإنترنت الدولية.`,
        seoTitle: 'البنوك المركزية توحد بروتوكولات تسوية العملات الرقمية للمؤسسات',
        metaDescription: 'مشروع هورايزون يقلص زمن تسوية التجارة الدولية إلى 40 ثانية بمشاركة 8 بنوك مركزية كبرى.',
        keywords: ['البنوك المركزية', 'العملات الرقمية للبنوك المركزية', 'التسوية المالية', 'مشروع هورايزون'],
        imageAlt: 'شاشات التداول وبيانات الأسواق المالية والسيولة في فرانكفورت.',
        faq: [
          {
            question: 'هل يؤثر هذا النظام على الحسابات الشخصية للأفراد؟',
            answer: 'لا، يقتصر النظام على التسويات الضخمة بين المؤسسات المالية والمصارف ولا يستهدف الأفراد أو المعاملات الاستهلاكية.',
          },
          {
            question: 'ما هي العملات المعتمدة في المرحلة الأولى؟',
            answer: 'تشمل المرحلة الأولى اليورو، والين الياباني، والجنيه الإسترليني، والدولار السنغافوري، مع التوسع لباقي العملات لاحقاً.',
          },
        ],
        translationStatus: 'complete',
        entities: ['مشروع هورايزون', 'البنك المركزي الأوروبي', 'بنك إنجلترا'],
      },
      de: {
        language: 'de',
        title: 'Zentralbanken vereinheitlichen digitale Großkunden-Abwicklungssysteme',
        slug: 'zentralbanken-digitale-abwicklung-horizon',
        executiveSummary: 'Acht internationale Notenbanken haben die Spezifikationen für das Projekt Horizon vorgestellt. Die gemeinsame Plattform verkürzt internationale Abrechnungszeiten von Tagen auf unter 40 Sekunden.',
        structuredBody: `## Neuer Meilenstein für die internationale Finanzmarkt-Infrastruktur

Acht führende Zentralbanken haben die gemeinsamen technischen Richtlinien für das grenzüberschreitende Verrechnungssystem Projekt Horizon veröffentlicht. Durch die Automatisierung sinkt der Bedarf an Vorfinanzierungspuffern um bis zu 87 Prozent.`,
        seoTitle: 'Projekt Horizon: Zentralbanken harmonisieren digitales Clearing',
        metaDescription: 'Acht Zentralbanken standardisieren Wholesale-Digitalwährungen zur Beschleunigung des Welthandels.',
        keywords: ['Zentralbanken', 'Projekt Horizon', 'Finanzmärkte', 'Clearing'],
        imageAlt: 'Finanzdaten und Handelsbildschirme an der Börse Frankfurt.',
        faq: [
          {
            question: 'Gilt das System für private Konten?',
            answer: 'Nein, es handelt sich ausschließlich um ein Abwicklungsinstrument für lizenzierte Finanzinstitute.',
          },
          {
            question: 'Welche Währungen starten zuerst?',
            answer: 'EUR, JPY, GBP und SGD bilden die erste Implementierungsphase.',
          },
        ],
        translationStatus: 'complete',
        entities: ['EZB', 'Bank of England', 'Projekt Horizon'],
      },
      es: {
        language: 'es',
        title: 'Los bancos centrales unifican las plataformas de liquidación digital mayorista',
        slug: 'bancos-centrales-liquidacion-digital-mayorista',
        executiveSummary: 'Ocho entidades emisoras clave completaron las pruebas de interoperabilidad de la iniciativa Proyecto Horizon, logrando reducir el tiempo de liquidación del comercio internacional a solo 40 segundos.',
        structuredBody: `## Avance estratégico en la infraestructura financiera internacional

Las autoridades monetarias de Fráncfort, Londres, Tokio y Singapur han presentado hoy los protocolos técnicos para el Proyecto Horizon, una red automatizada de compensación multidivisa para entidades financieras supervisadas.`,
        seoTitle: 'Los bancos centrales presentan la red de liquidación digital Proyecto Horizon',
        metaDescription: 'Ocho bancos centrales aceleran la liquidación comercial mayorista con transferencias en menos de 40 segundos.',
        keywords: ['Bancos Centrales', 'Proyecto Horizon', 'Finanzas Globales', 'Comercio'],
        imageAlt: 'Gráficos financieros y paneles de cotizaciones en tiempo real.',
        faq: [
          {
            question: '¿Afecta a las cuentas de los consumidores?',
            answer: 'No, está reservado a transacciones mayoristas e interbancarias de gran volumen.',
          },
          {
            question: '¿Qué monedas están incluidas?',
            answer: 'El euro, yen, libra esterlina y dólar de Singapur encabezan el despliegue.',
          },
        ],
        translationStatus: 'complete',
        entities: ['BCE', 'Banco de Inglaterra', 'Proyecto Horizon'],
      },
      fr: {
        language: 'fr',
        title: 'Les banques centrales harmonisent les règlements numériques interbancaires',
        slug: 'banques-centrales-reglements-numeriques-interbancaires',
        executiveSummary: 'Huit banques centrales majeures ont finalisé les protocoles de la plateforme Projet Horizon, réduisant les délais de règlement du commerce mondial de trois jours à moins de 40 secondes.',
        structuredBody: `## Une étape déterminante pour la compensation financière internationale

Les banques centrales de Francfort, Londres, Tokyo et Singapour ont dévoilé les standards du Projet Horizon. Le dispositif interbancaire permet d’éliminer les frictions de change et les délais traditionnels de compensation.`,
        seoTitle: 'Banques centrales : lancement de la plateforme Projet Horizon',
        metaDescription: 'Huit banques centrales automatisent la compensation transfrontalière pour le commerce international.',
        keywords: ['Banques centrales', 'Projet Horizon', 'Système financier', 'Règlements'],
        imageAlt: 'Écrans de transactions et cotations sur le parquet financier.',
        faq: [
          {
            question: 'Le dispositif concerne-t-il les particuliers ?',
            answer: 'Non, cette infrastructure est strictement dédiée aux opérations de gros entre institutions financières.',
          },
          {
            question: 'Quelles devises sont intégrées ?',
            answer: 'L’euro, le yen, la livre sterling et le dollar de Singapour figurent au lancement.',
          },
        ],
        translationStatus: 'complete',
        entities: ['BCE', 'Banque d’Angleterre', 'Projet Horizon'],
      },
    },
  },
  {
    id: 'art-003',
    category: 'technology',
    editorialType: 'original',
    originalSource: 'National Institute of Standards and Technology (NIST)',
    originalUrl: 'https://www.nist.gov/news-events/news/2024/08/nist-releases-first-3-finalized-post-quantum-encryption-standards',
    image: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Silicon Valley Science Archive / World News Tech',
    imageProvenance: 'Photonics laboratory testing bay, Stanford Research Park',
    imageLicense: 'Creative Commons CC-BY-NC Editorial Attribution',
    status: 'published',
    isBreaking: false,
    isPinned: false,
    priority: 8,
    views: 28400,
    shares: 2110,
    publishedAt: '2026-09-21T06:00:00Z',
    updatedAt: '2026-09-21T08:20:00Z',
    byline: 'Dr. Tariq Mansour & Jessica Cole',
    translations: {
      en: {
        language: 'en',
        title: 'International Consortium Deploys First Open Quantum-Safe Telecommunications Mesh',
        slug: 'open-quantum-safe-telecom-mesh-deployed',
        executiveSummary: 'An alliance of research institutes and telecom operators has activated a 4,200-kilometer quantum key distribution network spanning 18 European cities. The network shields critical civilian energy and hospital networks from post-quantum cryptographic compromise.',
        structuredBody: `## Securing Public Infrastructure Against Quantum Decryption

The Quantum Infrastructure Alliance (QIA) successfully brought online the longest continuous quantum-secured photonics mesh in history, verifying key distribution rates exceeding 14 megabits per second across fiber relays.

By leveraging dual-state entanglement routing and decentralized key-escrow nodes, the topology withstands direct optical interception without detectable data leakage.

### Deployment Architecture

* **Point-to-Point Relays:** 38 trusted optical regeneration nodes built into municipal data facilities.
* **Open Hardware Specification:** Hardware schematics and driver firmware released under permissive public licenses.
* **Civilian Priority:** Initial bandwidth dedicated to high-voltage electric grid monitoring and hospital biometric transfer links.`,
        seoTitle: 'Open Quantum-Safe Telecommunications Network Deployed Across 18 Cities',
        metaDescription: 'A 4,200-km quantum key distribution mesh is activated across Europe to safeguard civilian infrastructure against quantum decryption threats.',
        keywords: ['Quantum Key Distribution', 'Cybersecurity', 'Photonics', 'Quantum Computing', 'Infrastructure'],
        imageAlt: 'Quantum optics laboratory laser bench during fiber entanglement calibration.',
        faq: [
          {
            question: 'What happens if a photon in the quantum line is intercepted?',
            answer: 'Any eavesdropping attempt alters the quantum quantum state of the photon, immediately aborting the key exchange and alerting operators.',
          },
          {
            question: 'Is this network accessible to commercial enterprises?',
            answer: 'Commercial access opens in early 2027 following completion of the municipal infrastructure testing phase.',
          },
        ],
        translationStatus: 'complete',
        entities: ['QIA', 'Quantum Key Distribution', 'Cybersecurity'],
      },
      ar: {
        language: 'ar',
        title: 'إطلاق أول شبكة اتصالات مفتوحة مقاومة للاختراق الكمومي عبر 18 مدينة',
        slug: 'open-quantum-safe-telecom-mesh-deployed-ar',
        executiveSummary: 'دشّن تحالف علمي وتقني دولي شبكة ألياف ضوئية بطول 4200 كيلومتر تعتمد توزيع المفاتيح الكمومية لحماية البنى التحتية المدنية وشبكات الطاقة والمستشفيات من مخاطر الحوسبة الكمومية المستقبلية.',
        structuredBody: `## تحصين المنشآت الحيوية في عصر الحوسبة الكمومية

أعلن تحالف البنية التحتية الكمومية عن تشغيل أطول مسار اتصالات مؤمن بتقنيات التشفير الكمومي في العالم، بمعدلات نقل مفاتيح تشفير فائقة السرعة تتجاوز 14 ميغابت في الثانية عبر العقد الضوئية.

وتوفر الشبكة درعاً تقنياً منيعاً ضد محاولات اعتراض الإشارات الضوئية أو فك التشفير المستقبلي بفضل فيزياء التشابك الكمومي.

### مواصفات الشبكة المفتوحة

* **38 عقدة تجديد ضوئي موثوقة** موزعة داخل مراكز بيانات مدنية متقدمة.
* **تصاميم مفتوحة المصدر:** إتاحة البرمجيات والعتاد للأكاديميات ومراكز الأبحاث المستقلة.
* **أولوية حماية الخدمات الحيوية:** تخصيص السعة الأولية للربط الآمن لشبكات الكهرباء والمستشفيات الجامعية.`,
        seoTitle: 'تدشين أول شبكة اتصالات كمومية مفتوحة بطول 4200 كم',
        metaDescription: 'تحالف دولي يطلق شبكة توزيع المفاتيح الكمومية لحماية البنى التحتية المدنية عبر 18 مدينة.',
        keywords: ['التشفير الكمومي', 'الأمن السيبراني', 'الحوسبة الكمومية', 'شبكات الألياف'],
        imageAlt: 'أجهزة ومعدات مختبر البصريات الكمومية ومعايرة حزم الليزر.',
        faq: [
          {
            question: 'ماذا يحدث في حال محاولة اعتراض الإشارة الكمومية؟',
            answer: 'أي محاولة للتجسس تُحدث اضطراباً في الحالة الفيزيائية للفوتون، مما يؤدي فوراً إلى إلغاء المفتاح وإخطار مركز المراقبة.',
          },
          {
            question: 'متى تتاح الخدمة للقطاع التجاري؟',
            answer: 'سيتم فتح باب الاشتراك للمؤسسات التجارية في مطلع عام 2027 بعد استكمال اختبارات الأمان.',
          },
        ],
        translationStatus: 'complete',
        entities: ['توزيع المفاتيح الكمومية', 'الأمن السيبراني'],
      },
      de: {
        language: 'de',
        title: 'Erstes offenes quantensicheres Telekommunikationsnetz in 18 Städten in Betrieb',
        slug: 'erstes-quantensicheres-telekom-netz',
        executiveSummary: 'Ein Forschungsbündnis hat ein 4.200 Kilometer langes Quantenschlüsselnetz aktiviert. Die Glasfaserarchitektur schützt kritische Infrastrukturen vor zukünftigen Entschlüsselungsangriffen.',
        structuredBody: `## Quantenverschlüsselung für zivile Versorgungsnetze

Das Konsortium der Quantum Infrastructure Alliance meldet die erfolgreiche Inbetriebnahme eines 4.200 km langen Glasfasernetzes zur quantensicheren Schlüsselverteilung mit 14 Mbit/s Durchsatz.`,
        seoTitle: 'Quantensicheres Telekommunikationsnetzwerk über 4.200 km gestartet',
        metaDescription: 'Europaweites Quantenschlüssel-Netzwerk schützt Energie- und Gesundheitsnetze vor Cyberangriffen.',
        keywords: ['Quantenverschlüsselung', 'Cyberabwehr', 'Telekommunikation'],
        imageAlt: 'Optisches Labor mit Quantenlaser-Aufbau.',
        faq: [
          {
            question: 'Wie wird ein Abhörversuch erkannt?',
            answer: 'Jeder Eingriff zerstört den quantenmechanischen Zustand der Photonen und bricht die Übertragung ab.',
          },
        ],
        translationStatus: 'complete',
        entities: ['QIA', 'Quantenschlüssel'],
      },
      es: {
        language: 'es',
        title: 'Despliegan la primera red abierta de telecomunicaciones cuánticamente segura',
        slug: 'primera-red-telecomunicaciones-cuantica',
        executiveSummary: 'Una alianza de operadores e institutos de investigación activó una red de distribución cuántica de 4.200 kilómetros que protege redes eléctricas y hospitales frente a futuros ataques.',
        structuredBody: `## Ciberdefensa civil basada en física cuántica

La Alianza de Infraestructura Cuántica ha puesto en servicio la red fotónica cuántica continua más extensa hasta la fecha, con velocidades de distribución de claves de 14 Mbps en 18 ciudades.`,
        seoTitle: 'Red abierta de telecomunicaciones cuánticamente seguras en 18 ciudades',
        metaDescription: 'Red de distribución cuántica de claves de 4.200 km entra en servicio para salvaguardar infraestructuras críticas.',
        keywords: ['Criptografía Cuántica', 'Telecomunicaciones', 'Ciberseguridad'],
        imageAlt: 'Mesa de óptica cuántica durante la calibración de haces láser.',
        faq: [
          {
            question: '¿Qué ocurre ante una interceptación?',
            answer: 'La física cuántica altera el fotón de inmediato, invalidando la clave e informando a los operadores.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Criptografía Cuántica'],
      },
      fr: {
        language: 'fr',
        title: 'Déploiement du premier réseau télécom ouvert à sécurité quantique',
        slug: 'deploiement-reseau-telecom-securite-quantique',
        executiveSummary: 'Une alliance d’opérateurs et de laboratoires a mis en service un maillage de distribution quantique de 4 200 km reliant 18 métropoles pour sécuriser les réseaux d’énergie et les hôpitaux.',
        structuredBody: `## Protéger les infrastructures vitales contre les futurs calculateurs quantiques

L’Alliance pour l’infrastructure quantique a activé aujourd’hui le plus vaste réseau photonique de distribution de clés quantiques au monde, garantissant un débit supérieur à 14 mégabits par seconde.`,
        seoTitle: 'Mise en service d’un réseau télécom quantique de 4 200 km',
        metaDescription: '18 villes européennes connectées par un réseau quantique pour prémunir les infrastructures civiles du piratage.',
        keywords: ['Cryptographie quantique', 'Cybersécurité', 'Infrastructures'],
        imageAlt: 'Banc optique expérimental de physique quantique.',
        faq: [
          {
            question: 'Comment une tentative d’écoute est-elle déjouée ?',
            answer: 'La mesure d’un photon perturbe son état quantique, ce qui annule immédiatement l’échange de clé.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Cryptographie quantique', 'Télécoms'],
      },
    },
  },
  {
    id: 'art-004',
    category: 'health',
    editorialType: 'original',
    originalSource: 'World Health Organization (WHO) Global Health Bureau',
    originalUrl: 'https://www.who.int/news/item/02-10-2023-who-recommends-r21-matrix-m-vaccine-for-malaria-prevention-in-updated-advice-on-immunization',
    image: 'https://images.unsplash.com/photo-1584515979956-d9f6e5d09982?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Dr. Amina Touré / Global Health Collaborative',
    imageProvenance: 'Pediatric clinic vaccination station, Dakar Regional Hospital',
    imageLicense: 'Editorial open access medical archive',
    status: 'published',
    isBreaking: false,
    isPinned: false,
    priority: 7,
    views: 19800,
    shares: 1240,
    publishedAt: '2026-09-20T16:45:00Z',
    updatedAt: '2026-09-21T05:30:00Z',
    byline: 'Dr. Amina Touré & Michael Hastings',
    hasVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=6v2L2UGZJAM',
    videoIframeUrl: 'https://www.youtube.com/embed/6v2L2UGZJAM?autoplay=0&rel=0&modestbranding=1',
    videoThumbnail: 'https://img.youtube.com/vi/6v2L2UGZJAM/maxresdefault.jpg',
    translations: {
      en: {
        language: 'en',
        title: 'Universal Second-Generation Malaria Vaccine Reaches 12 Million Children Across Equatorial Africa',
        slug: 'universal-second-generation-malaria-vaccine-rollout',
        executiveSummary: 'Public health ministers reported a 74% drop in severe pediatric malaria hospital admissions following the synchronized rollout of second-generation pre-erythrocytic vaccines across 14 endemic nations.',
        structuredBody: `## A Turning Point in Global Infectious Disease Control

Surveillance data released this morning at the African Epidemiological Observatory in Dakar confirmed that more than 12 million children under five years of age have received full immunization courses of the R21-M2 pre-erythrocytic vaccine.

The regional campaign, coordinated with the African Vaccine Manufacturing Initiative, produced 80 million doses domestically within three automated facility hubs.

### Epidemiological Findings

1. **Severe Admissions Reduced:** Tertiary hospitals recorded a 74% decline in emergency pediatric admissions related to cerebral malaria.
2. **Cold-Chain Independence:** The modified formulation maintains structural efficacy at ambient temperatures up to 37°C for 28 days.
3. **Maternal Protection:** Co-administered prophylactic guidance reduced perinatal transmission risks by two thirds.`,
        seoTitle: 'Second-Generation Malaria Vaccine Cuts Severe Cases by 74% in Africa',
        metaDescription: '12 million children receive universal malaria immunization as domestic manufacturing accelerates across 14 nations.',
        keywords: ['Malaria Vaccine', 'Global Health', 'Pediatrics', 'Epidemiology', 'Public Health'],
        imageAlt: 'Healthcare worker administering vaccine drops in a clinic in Dakar.',
        faq: [
          {
            question: 'How many doses are required for full immunity?',
            answer: 'The primary series consists of three initial doses administered at monthly intervals, followed by a booster dose 12 months later.',
          },
          {
            question: 'Is domestic manufacturing sufficient to meet continental demand?',
            answer: 'Yes, existing facilities in Senegal, Ghana, and Rwanda have achieved capacity to manufacture over 100 million doses annually.',
          },
        ],
        translationStatus: 'complete',
        entities: ['WHO', 'Dakar', 'Malaria Vaccine', 'R21-M2'],
      },
      ar: {
        language: 'ar',
        title: 'لقاح الملاريا من الجيل الثاني يصل إلى 12 مليون طفل ويخفض الحالات الحرجة بنسبة 74%',
        slug: 'universal-second-generation-malaria-vaccine-rollout-ar',
        executiveSummary: 'أعلنت وزارات الصحة الإفريقية انخفاضاً غير مسبوق في حالات تنويم الأطفال المصابين بالملاريا الحادة بنسبة 74% عقب التوزيع المنظم للقاح الجيل الثاني المصنّع محلياً عبر 14 دولة.',
        structuredBody: `## إنجاز تاريخي في مكافحة الأمراض الوبائية

أكدت بيانات المرصد الوبائي الإفريقي في داكار أن أكثر من 12 مليون طفل دون سن الخامسة أتموا جرعات التحصين الكاملة بلقاح الملاريا المطور (R21-M2)، مما أحدث تحولاً جذرياً في معدلات البقاء على قيد الحياة.

وتميزت الحملة بالاعتماد على الإنتاج الإقليمي المستقل داخل ثلاثة مراكز تصنيع حيوية في السنغال وغانا ورواندا.

### أبرز مؤشرات المسح الوبائي

1. **انخفاض تاريخي في الإصابات الحادة:** سجلت المستشفيات تراجعاً بنسبة 74% في حالات الملاريا الدماغية بين الرضع.
2. **استقرار دون سلاسل التبريد المعقدة:** تحتفظ التركيبة بفعاليتها في درجات حرارة تصل إلى 37 مئوية لمدة 28 يوماً.
3. **تحقيق الاكتفاء الذاتي:** إنتاج أكثر من 80 مليون جرعة على أراضٍ إفريقية وبأيدٍ علمية محلية.`,
        seoTitle: 'لقاح الملاريا المتطور يخفض الحالات الحرجة 74% في 14 دولة',
        metaDescription: '12 مليون طفل يتلقون لقاح الملاريا من الجيل الثاني المصنع محلياً في إفريقيا.',
        keywords: ['لقاح الملاريا', 'الصحة العالمية', 'طب الأطفال', 'داكار'],
        imageAlt: 'طبيبة تقدم الرعاية الصحية والتطعيم لأحد الأطفال في مركز صحي بداكار.',
        faq: [
          {
            question: 'كم عدد الجرعات اللازمة لاكتساب المناعة المستدامة؟',
            answer: 'يتطلب البروتوكول الطبي ثلاث جرعات أساسية يفصل بينها شهر، تليها جرعة منشطة بعد عام واحد.',
          },
          {
            question: 'هل يغطي الإنتاج الإفريقي حاجة القارة بالكامل؟',
            answer: 'نعم، تصل الطاقة الإنتاجية للمصانع المحلية إلى ما يزيد عن 100 مليون جرعة سنوياً.',
          },
        ],
        translationStatus: 'complete',
        entities: ['منظمة الصحة العالمية', 'لقاح الملاريا', 'داكار'],
      },
      de: {
        language: 'de',
        title: 'Neuer Malaria-Impfstoff erreicht 12 Millionen Kinder in Afrika – Schwere Verläufe um 74 % gesenkt',
        slug: 'malaria-impfstoff-rollout-afrika',
        executiveSummary: 'Gesundheitsbehörden melden einen drastischen Rückgang schwerer Krankenhauseinweisungen bei Kindern nach dem flächendeckenden Einsatz des Vakzins der zweiten Generation in 14 Ländern.',
        structuredBody: `## Durchbruch im Kampf gegen die Infektionskrankheit

Die epidemiologischen Daten aus Dakar belegen den Erfolg der Impfkampagne: Über 12 Millionen Kinder wurden mit dem R21-M2-Vakzin versorgt, was zu einem Rückgang schwerer Verläufe um 74 Prozent führte.`,
        seoTitle: 'Malaria-Impfstoff senkt schwere Erkrankungen bei Kindern um 74 Prozent',
        metaDescription: 'Erfolgreicher Einsatz des neuen Malaria-Impfstoffs in 14 afrikanischen Ländern.',
        keywords: ['Malaria', 'Gesundheit', 'Impfung', 'Afrika'],
        imageAlt: 'Impfung eines Kindes in einer medizinischen Station.',
        faq: [
          {
            question: 'Wie viele Dosen sind notwendig?',
            answer: 'Drei Grundimmunisierungen plus eine Auffrischung nach zwölf Monaten.',
          },
        ],
        translationStatus: 'complete',
        entities: ['WHO', 'Malaria'],
      },
      es: {
        language: 'es',
        title: 'La vacuna de segunda generación contra la malaria llega a 12 millones de niños',
        slug: 'vacuna-malaria-segunda-generacion-africa',
        executiveSummary: 'Las autoridades sanitarias constatan una reducción del 74% en los ingresos hospitalarios graves por malaria pediátrica tras la campaña de vacunación en 14 países africanos.',
        structuredBody: `## Hito médico en la lucha contra la malaria

Datos del Observatorio Epidemiológico de Dakar confirman que más de 12 millones de menores de cinco años han recibido la pauta completa de la vacuna R21-M2 fabricada en centros de producción regionales.`,
        seoTitle: 'La vacuna contra la malaria reduce un 74% los casos graves infantiles',
        metaDescription: '12 millones de niños reciben la vacuna contra la malaria con fabricación propia en África.',
        keywords: ['Vacuna Malaria', 'Salud Pública', 'Pediatría'],
        imageAlt: 'Personal sanitario aplicando la vacuna en un centro médico de Dakar.',
        faq: [
          {
            question: '¿Cuántas dosis se requieren?',
            answer: 'Tres dosis mensuales y un refuerzo al año.',
          },
        ],
        translationStatus: 'complete',
        entities: ['OMS', 'Malaria'],
      },
      fr: {
        language: 'fr',
        title: 'Le vaccin antipaludique de 2e génération administré à 12 millions d’enfants en Afrique',
        slug: 'vaccin-paludisme-deuxieme-generation-afrique',
        executiveSummary: 'Les ministères de la Santé enregistrent une baisse de 74 % des hospitalisations pédiatriques graves grâce au déploiement coordonné du vaccin R21-M2 produit localement dans 14 pays.',
        structuredBody: `## Tournant historique pour la santé publique internationale

Les données publiées par l’Observatoire épidémiologique de Dakar confirment l’immunisation de plus de 12 millions d’enfants de moins de cinq ans grâce au vaccin R21-M2 produit en partie au Sénégal, au Ghana et au Rwanda.`,
        seoTitle: 'Paludisme : le nouveau vaccin réduit les cas graves de 74 %',
        metaDescription: '12 millions d’enfants vaccinés contre le paludisme avec une production pharmaceutique locale.',
        keywords: ['Paludisme', 'Vaccin', 'Santé mondiale', 'Afrique'],
        imageAlt: 'Personnel soignant administrant le vaccin pédiatrique à Dakar.',
        faq: [
          {
            question: 'Combien d’injections sont nécessaires ?',
            answer: 'Trois doses initiales suivies d’un rappel à 12 mois.',
          },
        ],
        translationStatus: 'complete',
        entities: ['OMS', 'Paludisme', 'Dakar'],
      },
    },
  },
  {
    id: 'art-005',
    category: 'culture',
    editorialType: 'opinion',
    originalSource: 'UNESCO World Heritage & Cultural Preservation Bureau',
    originalUrl: 'https://www.unesco.org/en/articles/cultural-heritage-crisis-and-conflict',
    image: 'https://images.unsplash.com/photo-1544717305-2782549b5136?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Leila Kaddour / Heritage Futures Trust',
    imageProvenance: 'Baghdad Museum ancient clay tablet archival chamber',
    imageLicense: 'Editorial Culture Archive License',
    status: 'published',
    isBreaking: false,
    isPinned: false,
    priority: 6,
    views: 14200,
    shares: 880,
    publishedAt: '2026-09-20T11:20:00Z',
    updatedAt: '2026-09-20T14:10:00Z',
    byline: 'Dr. Tariq Al-Jamil (Guest Scholar)',
    translations: {
      en: {
        language: 'en',
        title: 'The Digital Reclamation of Mesopotamia: When Ancient Cuneiform Meets Open Volumetric Scanning',
        slug: 'digital-reclamation-mesopotamian-cuneiform-tablets',
        executiveSummary: 'An open collaborative initiative between Iraqi archaeologists and international universities has digitized over 180,000 fragmentary cuneiform tablets in ultra-high resolution 3D, reconstructing lost literary epics and civic ledgers across dispersed global museum holdings.',
        structuredBody: `## Piecing Together Five Millennia of Written Memory

For more than a century, the textual heritage of ancient Sumer, Akkad, and Babylon remained physically dismembered across basements and display cases in Europe, the Americas, and the Near East.

The Digital Mesopotamia Project has changed the paradigm of archaeological stewardship. Using multi-spectral volumetric photogrammetry, scholars have re-assembled fragmented clay contracts and celestial observations that had been separated for generations.

### Cultural Sovereignty Over Physical Dispersal

1. **Virtual Repatriation:** Iraqi scholars retain universal master curation privileges over the centralized open cloud repository.
2. **AI Translation Assistance:** Neural transliteration engines decipher archaic dialect nuances, accelerating translation workflows from decades to days.
3. **Public Commons:** Every 3D mesh is released under non-commercial cultural commons licenses for schools and researchers worldwide.`,
        seoTitle: 'Mesopotamian Cuneiform Tablets Reconstructed via Open 3D Scanning',
        metaDescription: '180,000 ancient clay tablets are reunited digitally in an open initiative uniting Iraqi historians and global institutions.',
        keywords: ['Archaeology', 'Mesopotamia', 'Cuneiform', 'Digital Heritage', 'Baghdad Museum'],
        imageAlt: 'Clay cuneiform tablet under precision archival illumination for volumetric 3D scanning.',
        faq: [
          {
            question: 'Can the public view and 3D print these artifacts?',
            answer: 'Yes, all digitized tablets are accessible through an interactive viewer with downloadable STL meshes for educational replication.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Baghdad Museum', 'Mesopotamia', 'Cuneiform', 'Heritage'],
      },
      ar: {
        language: 'ar',
        title: 'استعادة الذاكرة الرافدينية: عندما يلتقي الخط المسماري العريق بالمسح ثلاثي الأبعاد المفتوح',
        slug: 'digital-reclamation-mesopotamian-cuneiform-tablets-ar',
        executiveSummary: 'مبادرة علمية مشتركة تجمع علماء الآثار العراقيين بمؤسسات دولية تنجح في رقمنة 180 ألف رقيم طيني مسماري بتقنيات المسح الحجمي فائق الدقة، مما يعيد لم شمل الملاحم وسجلات الحضارة السومرية والبابلية المشتتة عبر متاحف العالم.',
        structuredBody: `## إعادة تجميع خمسة آلاف عام من الذاكرة الإنسانية المدونة

على مدى أكثر من قرن، ظل الإرث الكتابي المسماري لحضارات سومر وأكد وبابل موزعاً في خزائن وصناديق متاحف عبر قارات مختلفة، مما عاق قراءة النصوص الملحمية والمدونات القانونية بشكل متكامل.

ويمثل مشروع "بلاد الرافدين الرقمي" نموذجاً جديداً للسيادة الثقافية واستعادة التراث؛ حيث تمكنت فرق العمل من مطابقة شظايا الألواح المكسورة بدقة ميكرومترية دون الحاجة لنقل القطع الأصلية من مقراتها.

### أبعاد المبادرة الثقافية والحضارية

1. **الاسترداد الرقمي الكامل:** يتمتع الباحثون في المتحف العراقي بحقوق الإشراف والتحكيم الكاملة على السجل الرقمي السحابي الموحد.
2. **الذكاء الاصطناعي في خدمة فك الرموز:** مساعدة الخوارزميات في تصنيف الرموز المسمارية النادرة ومضاهاة الكسور الحجرية بدقة متناهية.
3. **الملكية العامة للتعليم:** إتاحة النماذج ثلاثية الأبعاد للجامعات والمدارس حول العالم مجاناً لنشر المعرفة التاريخية.`,
        seoTitle: 'رقمنة 180 ألف رقيم مسماري لحضارة بلاد الرافدين بتقنيات ثلاثية الأبعاد',
        metaDescription: 'مبادرة عراقية دولية تعيد لم شمل ألواح بابل وسومر المسمارية رقمياً عبر متاحف العالم.',
        keywords: ['آثار العراق', 'الخط المسماري', 'بلاد الرافدين', 'التراث الرقمي', 'المتحف العراقي'],
        imageAlt: 'لوح طيني مسماري يخضع للمسح الضوئي الحجمي ثلاثي الأبعاد في بغداد.',
        faq: [
          {
            question: 'هل يمكن للجمهور تصفح هذه الألواح وطباعتها ثلاثية الأبعاد؟',
            answer: 'نعم، المنصة تتيح عارضاً تفاعلياً مفتوحاً يتيح تحميل ملفات الألواح للطلاب والباحثين مجاناً.',
          },
        ],
        translationStatus: 'complete',
        entities: ['المتحف العراقي', 'بلاد الرافدين', 'الخط المسماري'],
      },
      de: {
        language: 'de',
        title: 'Die digitale Rückkehr Mesopotamiens: Keilschrifttafeln im hochauflösenden 3D-Scan',
        slug: 'mesopotamien-keilschrifttafeln-digitalisiert',
        executiveSummary: 'Eine irakisch-internationale Initiative hat 180.000 Keilschrifttafeln digital zusammengeführt und damit verstreute Archive der Antike für die Weltöffentlichkeit zugänglich gemacht.',
        structuredBody: `## Fünf Jahrtausende Schriftkultur digital vereint

Das Projekt Digitales Mesopotamien führt weltweit zerstreute Tontafeln der Hochkulturen von Sumer und Babylon in einem offenen hochauflösenden 3D-Archiv zusammen.`,
        seoTitle: '180.000 Keilschrifttafeln aus Mesopotamien digital rekonstruiert',
        metaDescription: 'Offene Initiative führt mesopotamische Tontafeln aus Museen weltweit digital zusammen.',
        keywords: ['Archäologie', 'Mesopotamien', 'Keilschrift', 'Kulturerbe'],
        imageAlt: 'Keilschrifttafel unter spezieller Beleuchtung beim 3D-Scan.',
        faq: [
          {
            question: 'Sind die 3D-Modelle frei zugänglich?',
            answer: 'Ja, alle Datensätze stehen für Bildung und Forschung kostenfrei zur Verfügung.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Mesopotamien', 'Keilschrift'],
      },
      es: {
        language: 'es',
        title: 'La recuperación digital de Mesopotamia: tablas cuneiformes en escaneo tridimensional',
        slug: 'recuperacion-digital-mesopotamia-tablas-cuneiformes',
        executiveSummary: 'Una alianza arqueológica entre Irak y universidades internacionales ha digitalizado 180.000 tablillas cuneiformes en 3D, uniendo fragmentos dispersos por museos de todo el planeta.',
        structuredBody: `## Reconstruyendo el patrimonio escrito más antiguo del mundo

El Proyecto Mesopotamia Digital ha logrado recomponer virtualmente archivos milenarios de Sumeria y Babilonia gracias a la fotogrametría volumétrica multiespectral.`,
        seoTitle: '180.000 tablillas cuneiformes de Mesopotamia reunidas digitalmente en 3D',
        metaDescription: 'Iniciativa internacional une virtualmente el patrimonio arqueológico de Irak disperso por el mundo.',
        keywords: ['Arqueología', 'Mesopotamia', 'Tablillas Cuneiformes', 'Patrimonio'],
        imageAlt: 'Tablilla de arcilla cuneiforme durante el proceso de escaneo tridimensional.',
        faq: [
          {
            question: '¿Se pueden descargar los modelos 3D?',
            answer: 'Sí, la plataforma ofrece acceso libre y descargas para fines pedagógicos e investigación.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Mesopotamia', 'Cuneiforme'],
      },
      fr: {
        language: 'fr',
        title: 'La renaissance numérique de la Mésopotamie : les tablettes cunéiformes réunies en 3D',
        slug: 'renaissance-numerique-mesopotamie-tablettes-cuneiformes',
        executiveSummary: 'Une initiative menée par des archéologues irakiens et des universités internationales a numérisé 180 000 tablettes cunéiformes en 3D, reconstituant des épopées antiques dispersées.',
        structuredBody: `## Rassembler cinq millénaires de mémoire écrite

Pendant plus d’un siècle, le patrimoine textuel de Sumer, d’Akkad et de Babylone est resté morcelé dans des musées du monde entier. Le projet Mésopotamie Numérique recrée cette unité par la photogrammétrie volumétrique.`,
        seoTitle: '180 000 tablettes cunéiformes mésopotamiennes réunies en 3D',
        metaDescription: 'Archéologues irakiens et internationaux rassemblent virtuellement le patrimoine antique de Mésopotamie.',
        keywords: ['Archéologie', 'Mésopotamie', 'Cunéiforme', 'Patrimoine'],
        imageAlt: 'Tablette cunéiforme en argile sous un éclairage de numérisation 3D.',
        faq: [
          {
            question: 'Les modèles sont-ils accessibles librement ?',
            answer: 'Oui, l’ensemble des tablettes est consultable dans un visualiseur interactif ouvert.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Mésopotamie', 'Cunéiforme'],
      },
    },
  },
  {
    id: 'art-006',
    category: 'sports',
    editorialType: 'original',
    originalSource: 'International Olympic Committee (IOC) Sustainability Bureau',
    originalUrl: 'https://olympics.com/ioc/sustainability',
    image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'Marc Dubois / Olympic Press Pool',
    imageProvenance: 'Olympic Stadium architecture preview, Lausanne headquarters',
    imageLicense: 'World News Sports Accreditation',
    status: 'published',
    isBreaking: false,
    isPinned: false,
    priority: 5,
    views: 16500,
    shares: 940,
    publishedAt: '2026-09-19T18:00:00Z',
    updatedAt: '2026-09-20T08:15:00Z',
    byline: 'Claire Fontaine & Diego Morales',
    hasVideo: true,
    videoUrl: 'https://www.youtube.com/watch?v=u31qwQUeGuM',
    videoIframeUrl: 'https://www.youtube.com/embed/u31qwQUeGuM?autoplay=0&rel=0&modestbranding=1',
    videoThumbnail: 'https://img.youtube.com/vi/u31qwQUeGuM/maxresdefault.jpg',
    translations: {
      en: {
        language: 'en',
        title: 'Olympic Host Cities Adopt Permanent Modular Housing Mandate to Prevent White Elephants',
        slug: 'olympic-host-cities-modular-housing-mandate',
        executiveSummary: 'The International Olympic Committee ratified a landmark amendment requiring all prospective host cities to assemble athletes’ villages from recyclable timber modules that convert into municipal public housing within 90 days of closing ceremonies.',
        structuredBody: `## Ending the Era of Abandoned Mega-Stadiums

In a decisive move to restore public faith in major athletic spectacles, international sport governing bodies approved the "Post-Games Urban Utility Charter" in Lausanne today.

Under the new regulations, host committees are barred from erecting monolithic athletes’ quarters that lack guaranteed civic tenant conversion agreements.

### Core Architecture Rules

* **90-Day Transition Window:** Modules must be dismounted and transferred to designated social housing districts within three months.
* **Embodied Carbon Caps:** Buildings must prioritize cross-laminated regional timber over concrete.
* **Budget Penalties:** Host federations face withholding of broadcast dividends if residential units remain unoccupied.`,
        seoTitle: 'Olympics Mandate Modular Housing to End Host City Debt Traps',
        metaDescription: 'New Olympic charter requires athletes villages to transition into municipal public housing within 90 days.',
        keywords: ['Olympic Games', 'Sports Infrastructure', 'Urban Planning', 'Lausanne', 'Sustainability'],
        imageAlt: 'Athletics stadium track and sustainable wooden grandstand architecture.',
        faq: [
          {
            question: 'When does the modular mandate take effect?',
            answer: 'The mandate applies to all bids submitted for 2036 and beyond, with voluntary pilot adherence encouraged for 2032.',
          },
        ],
        translationStatus: 'complete',
        entities: ['IOC', 'Lausanne', 'Olympic Games'],
      },
      ar: {
        language: 'ar',
        title: 'اللجنة الأولمبية تفرض معايير المساكن المعيارية المستدامة لحماية مدن الاستضافة من الخسائر',
        slug: 'olympic-host-cities-modular-housing-mandate-ar',
        executiveSummary: 'أقرت الهيئات الرياضية الدولية في لوزان ميثاقاً ملزماً يفرض تشييد قرى اللاعبين الأولمبيين من وحدات خشبية قابلة للتفكيك والتحويل إلى مساكن اجتماعية للمواطنين خلال تسعين يوماً من اختتام المنافسات.',
        structuredBody: `## إنهاء عصر المنشآت الرياضية المهجورة والديون المتراكمة

في خطوة لإنهاء ظاهرة "الأفيال البيضاء" والملاعب الضخمة المهجورة بعد انتهاء الدورات الأولمبية، صادقت اللجنة الأولمبية الدولية في لوزان اليوم على ميثاق الاستدامة الحضرية.

ويمنع الميثاق الجديد المدن المستضيفة من تشييد مجمعات إسكان خرسانية مكلفة لا تتوفر لها خطط استيعاب سكني مؤكدة للمجتمعات المحلية.`,
        seoTitle: 'الأولمبياد تفرض تشييد قرى الرياضيين المعيارية للتحول إلى إسكان شعبي',
        metaDescription: 'ميثاق لوزان يلزم مدن الألعاب الأولمبية بتحويل مساكن الرياضيين إلى أحياء سكنية للمواطنين خلال 90 يوماً.',
        keywords: ['الألعاب الأولمبية', 'لوزان', 'الاستدامة الرياضية', 'التخطيط الحضري'],
        imageAlt: 'مضمار ألعاب القوى مع تصميم معماري مستدام من الأخشاب المعالجة.',
        faq: [
          {
            question: 'متى يبدأ تطبيق هذا القرار رسمياً؟',
            answer: 'يسري القرار بشكل إلزامي على كافة ملفات الترشح لدورات 2036 وما بعدها مع تشجيع الالتزام الطوعي.',
          },
        ],
        translationStatus: 'complete',
        entities: ['اللجنة الأولمبية الدولية', 'لوزان'],
      },
      de: {
        language: 'de',
        title: 'Olympisches Komitee beschließt Pflicht zu modularen Athletendörfern für sozialen Wohnbau',
        slug: 'olympia-modulare-athletendoerfer-sozialwohnung',
        executiveSummary: 'Das IOC verpflichtet künftige Ausrichterstädte zur Verwendung rückbaubarer Holzmodule, die binnen 90 Tagen nach den Spielen in bezahlbaren städtischen Wohnraum umgewandelt werden.',
        structuredBody: `## Nie wieder Bauruinen nach den Spielen

Das Internationale Olympische Komitee verabschiedete in Lausanne die neue "Charta für urbane Nachnutzung". Athletendörfer müssen künftig aus Holzmodulen errichtet werden, die innerhalb von drei Monaten dem sozialen Wohnungsbau zugeführt werden.`,
        seoTitle: 'IOC beschließt Pflicht für modulare Athletendörfer',
        metaDescription: 'Neue Olympia-Richtlinie verlangt Umwandlung von Athletendörfern in Sozialwohnungen binnen 90 Tagen.',
        keywords: ['Olympia', 'IOC', 'Lausanne', 'Wohnungsbau'],
        imageAlt: 'Leichtathletikstadion mit nachhaltiger Holzarchitektur.',
        faq: [
          {
            question: 'Ab wann gilt die Regelung?',
            answer: 'Verbindlich ab den Bewerbungen für das Jahr 2036.',
          },
        ],
        translationStatus: 'complete',
        entities: ['IOC', 'Lausanne'],
      },
      es: {
        language: 'es',
        title: 'El COI obligará a que las villas olímpicas se transformen en vivienda pública en 90 días',
        slug: 'coi-villas-olimpicas-vivienda-publica',
        executiveSummary: 'El Comité Olímpico Internacional aprobó en Lausana la norma que obliga a construir las villas deportivas con módulos desmontables para convertirlas en vivienda social tras los Juegos.',
        structuredBody: `## Fin a los "elefantes blancos" en las sedes olímpicas

Las autoridades deportivas mundiales ratificaron hoy en Suiza una reforma estructural: las instalaciones residenciales de los deportistas deberán reconvertirse en viviendas accesibles en un plazo máximo de tres meses.`,
        seoTitle: 'El COI exige villas olímpicas modulares para vivienda social',
        metaDescription: 'Las ciudades anfitrionas deberán convertir las villas de deportistas en barrios residenciales en 90 días.',
        keywords: ['Juegos Olímpicos', 'COI', 'Lausana', 'Urbanismo'],
        imageAlt: 'Pista de atletismo y tribunas de arquitectura sostenible.',
        faq: [
          {
            question: '¿Cuándo entra en vigor?',
            answer: 'Será obligatorio para las candidaturas de 2036 en adelante.',
          },
        ],
        translationStatus: 'complete',
        entities: ['COI', 'Lausana'],
      },
      fr: {
        language: 'fr',
        title: 'Le CIO impose des villages olympiques modulaires reconvertis en logements sociaux sous 90 jours',
        slug: 'cio-villages-olympiques-logements-sociaux',
        executiveSummary: 'Le Comité international olympique a ratifié à Lausanne une charte imposant des modules démontables en bois pour les athlètes, réutilisables en parcs locatifs publics après les Jeux.',
        structuredBody: `## La fin des éléphants blancs et des stades fantômes

Réuni à Lausanne, le CIO a adopté la Charte d’utilité urbaine post-Jeux. Les futures villes hôtes devront concevoir les hébergements sportifs comme de futurs quartiers populaires livrables sous trois mois.`,
        seoTitle: 'Le CIO impose la reconversion des villages olympiques en logements sociaux',
        metaDescription: 'Les hébergements des athlètes devront devenir des logements publics dans les 90 jours après la clôture des Jeux.',
        keywords: ['Jeux Olympiques', 'CIO', 'Lausanne', 'Urbanisme'],
        imageAlt: 'Piste d’athlétisme et architecture en bois durable.',
        faq: [
          {
            question: 'À partir de quelle édition la mesure s’applique-t-elle ?',
            answer: 'Elle devient contraignante pour les candidatures aux Jeux de 2036 et suivants.',
          },
        ],
        translationStatus: 'complete',
        entities: ['CIO', 'Lausanne'],
      },
    },
  },
  {
    id: 'art-007',
    category: 'politics',
    editorialType: 'original',
    originalSource: 'United Nations Office on Drugs and Crime (UNODC) Global Wire',
    originalUrl: 'https://www.unodc.org/unodc/en/corruption/index.html',
    image: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    imageCredit: 'European Parliamentary Pool / World News',
    imageProvenance: 'European Parliament Hemicycle chamber, Brussels',
    imageLicense: 'Official European Parliamentary Press Accreditation',
    status: 'published',
    isBreaking: false,
    isPinned: false,
    priority: 6,
    views: 21300,
    shares: 1100,
    publishedAt: '2026-09-19T14:30:00Z',
    updatedAt: '2026-09-20T09:00:00Z',
    byline: 'Jean-Luc Bernard & Sofia Lindqvist',
    translations: {
      en: {
        language: 'en',
        title: 'Global Whistleblower Defense Treaty Enters Into Force Across 48 Signatory States',
        slug: 'global-whistleblower-defense-treaty-enters-force',
        executiveSummary: 'The international treaty granting extraterritorial legal asylum and cryptographic protections to whistleblowers reporting systemic corporate or governmental corruption officially took legal effect at midnight.',
        structuredBody: `## New Legal Shield for Public Interest Disclosure

Forty-eight nations have enacted the International Whistleblower Asylum and Protection Treaty, creating an internationally recognized mechanism that protects witnesses reporting cross-border illicit financial flows and environmental violations.

The framework forbids signatory states from executing extradition warrants when evidence of public interest disclosure is corroborated by verified non-governmental ombudsman panels.`,
        seoTitle: 'International Whistleblower Protection Treaty Enters Into Force',
        metaDescription: '48 nations implement binding legal protections and asylum avenues for public interest whistleblowers.',
        keywords: ['Whistleblower', 'Rule of Law', 'Diplomacy', 'Transparency', 'Governance'],
        imageAlt: 'Assembly chamber of parliament during the voting session.',
        faq: [
          {
            question: 'Does the treaty cover national security intelligence disclosures?',
            answer: 'The treaty focuses primarily on financial malfeasance, human rights abuses, and severe environmental violations.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Transparency International', 'Council of Europe', 'Whistleblower Treaty'],
      },
      ar: {
        language: 'ar',
        title: 'سريان معاهدة الحماية القانونية الدولية لكاشفي الفساد والانتهاكات البيئية في 48 دولة',
        slug: 'global-whistleblower-defense-treaty-enters-force-ar',
        executiveSummary: 'دخلت حيز التنفيذ رسمياً معاهدة الحماية الدولية للمبلغين عن الفساد المالي والانتهاكات البيئية في 48 دولة، مما يمنح الشهود حصانة قضائية وحق اللجوء القانوني في قضايا المصلحة العامة.',
        structuredBody: `## مظلة قانونية جديدة لحماية المصلحة العامة

بدأ منتصف الليلة الماضية التطبيق الإلزامي للمعاهدة الدولية لحماية المبلغين وكاشفي الفساد المؤسسي، والتي تمنع تسليم المطلوبين في قضايا كشف الجرائم المالية المنظمة أو التلوث البيئي المتعمد.`,
        seoTitle: 'سريان معاهدة حماية المبلغين وكاشفي الفساد في 48 دولة',
        metaDescription: 'معاهدة دولية تمنح الحصانة واللجوء لكاشفي الفساد المالي والجرائم البيئية.',
        keywords: ['مكافحة الفساد', 'الشفافية الدولية', 'سيادة القانون', 'حقوق الإنسان'],
        imageAlt: 'قاعة التصويت البرلمانية أثناء إقرار المعاهدة القانونية.',
        faq: [
          {
            question: 'ما هي الشروط المسبقة للاستفادة من بنود الحماية؟',
            answer: 'توثيق البلاغات لدى لجان قضائية مستقلة تثبت أن الهدف هو خدمة المصلحة العامة وليس الإضرار بالأمن القومي.',
          },
        ],
        translationStatus: 'complete',
        entities: ['مكافحة الفساد', 'سيادة القانون'],
      },
      de: {
        language: 'de',
        title: 'Internationales Whistleblower-Schutzabkommen in 48 Staaten in Kraft getreten',
        slug: 'internationales-whistleblower-abkommen-in-kraft',
        executiveSummary: 'Ein neues völkerrechtliches Abkommen bietet Informanten bei Korruptions- und Umweltverbrechen internationalen Schutz vor Auslieferung und juristischer Verfolgung.',
        structuredBody: `## Rechtliche Immunität für Enthüllungen im öffentlichen Interesse

Das Abkommen verbietet Auslieferungsersuchen, wenn nachgewiesen werden kann, dass es sich um Veröffentlichungen zu Finanzkriminalität oder Umweltzerstörung handelt.`,
        seoTitle: 'Neues Whistleblower-Abkommen tritt in 48 Staaten in Kraft',
        metaDescription: 'Völkerrechtlicher Schutz für Whistleblower bei Enthüllungen zu Finanz- und Umweltkriminalität.',
        keywords: ['Whistleblower', 'Rechtsstaat', 'Transparenz'],
        imageAlt: 'Parlamentssaal während der Ratifizierung.',
        faq: [
          {
            question: 'Wer entscheidet über den Schutzstatus?',
            answer: 'Unabhängige Ombudsgremien und Gerichte der Zufluchtstaaten prüfen die Beweislage.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Whistleblower', 'Transparenz'],
      },
      es: {
        language: 'es',
        title: 'Entra en vigor el tratado internacional de protección a denunciantes de corrupción',
        slug: 'tratado-internacional-proteccion-denunciantes',
        executiveSummary: 'El acuerdo ratificado por 48 países otorga asilo jurídico e inmunidad frente a extradiciones a informantes que revelen delitos financieros graves o daños al medio ambiente.',
        structuredBody: `## Escudo judicial para proteger la verdad pública

El tratado multilateral prohíbe la entrega forzosa de informantes cuando sus revelaciones sirvan para destapar tramas de corrupción transfronteriza avaladas por juristas independientes.`,
        seoTitle: 'Entra en vigor el tratado que protege a denunciantes de corrupción en 48 países',
        metaDescription: 'Tratado internacional ampara a testigos de delitos financieros y abusos corporativos.',
        keywords: ['Anticorrupción', 'Transparencia', 'Estado de Derecho'],
        imageAlt: 'Hemiciclo parlamentario durante la votación de la ley.',
        faq: [
          {
            question: '¿Qué protección concreta se otorga?',
            answer: 'Asilo legal, protección de identidad y suspensión de órdenes de extradición.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Anticorrupción'],
      },
      fr: {
        language: 'fr',
        title: 'Entrée en vigueur du traité international de protection des lanceurs d’alerte',
        slug: 'entree-en-vigueur-traite-protection-lanceurs-alerte',
        executiveSummary: 'Le traité instaurant un asile juridique et un bouclier contre l’extradition pour les lanceurs d’alerte révélant des fraudes financières ou écologiques est entré en vigueur dans 48 pays.',
        structuredBody: `## Une protection juridique d’envergure pour l’intérêt général

Les 48 États signataires garantissent désormais l’immunité contre les poursuites abusives aux citoyens révélant des atteintes systémiques à l’environnement ou des réseaux de fraude fiscale.`,
        seoTitle: 'Le traité de protection des lanceurs d’alerte entre en vigueur dans 48 pays',
        metaDescription: 'Nouvelles garanties juridiques et droit d’asile pour les lanceurs d’alerte dans 48 États.',
        keywords: ['Lanceurs d’alerte', 'Transparence', 'État de droit'],
        imageAlt: 'Hémicycle parlementaire lors du vote du traité.',
        faq: [
          {
            question: 'Quels délits sont principalement ciblés ?',
            answer: 'La fraude fiscale internationale, la corruption politique et les crimes contre l’environnement.',
          },
        ],
        translationStatus: 'complete',
        entities: ['Lanceurs d’alerte'],
      },
    },
  },
];

export const INITIAL_NEWS_SOURCES: NewsSource[] = [
  {
    id: 'src-reuters',
    name: 'Reuters World Wire Service',
    rssUrl: 'https://feeds.reuters.com/reuters/worldNews',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: '2026-09-21T10:00:00Z',
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 142,
  },
  {
    id: 'src-ap',
    name: 'Associated Press International',
    rssUrl: 'https://hosted.ap.org/feeds/AP_International.rss',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: '2026-09-21T09:45:00Z',
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 118,
  },
  {
    id: 'src-bbc',
    name: 'BBC News Global Feed',
    rssUrl: 'https://feeds.bbci.co.uk/news/world/rss.xml',
    category: 'world',
    defaultLanguage: 'en',
    trustLevel: 'verified',
    isActive: true,
    lastImport: '2026-09-21T09:30:00Z',
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 95,
  },
  {
    id: 'src-aljazeera',
    name: 'Al Jazeera News Bureau (العربية)',
    rssUrl: 'https://www.aljazeera.net/aljazeerarss/a7c186be-1baa-4bd4-9d80-a84db769f779',
    category: 'world',
    defaultLanguage: 'ar',
    trustLevel: 'partner',
    isActive: true,
    lastImport: '2026-09-21T08:50:00Z',
    lastError: null,
    importFrequency: 'Every 60 minutes',
    articlesCount: 84,
  },
  {
    id: 'src-dw',
    name: 'Deutsche Welle World News',
    rssUrl: 'https://rss.dw.com/rdf/rss-de-all',
    category: 'economy',
    defaultLanguage: 'de',
    trustLevel: 'verified',
    isActive: true,
    lastImport: '2026-09-21T08:15:00Z',
    lastError: null,
    importFrequency: 'Every 120 minutes',
    articlesCount: 63,
  },
  {
    id: 'src-france24',
    name: 'France 24 International (Français)',
    rssUrl: 'https://www.france24.com/fr/rss',
    category: 'culture',
    defaultLanguage: 'fr',
    trustLevel: 'partner',
    isActive: true,
    lastImport: '2026-09-21T07:40:00Z',
    lastError: null,
    importFrequency: 'Every 120 minutes',
    articlesCount: 52,
  },
  {
    id: 'src-efe',
    name: 'Agencia EFE Internacional (Español)',
    rssUrl: 'https://www.efe.com/efe/espana/1/rss',
    category: 'politics',
    defaultLanguage: 'es',
    trustLevel: 'verified',
    isActive: true,
    lastImport: '2026-09-21T07:10:00Z',
    lastError: null,
    importFrequency: 'Every 120 minutes',
    articlesCount: 47,
  },
];

export const INITIAL_COMMENTS: Comment[] = [
  {
    id: 'comm-101',
    articleId: 'art-001',
    authorName: 'Dr. Klaus Richter',
    content: 'The binding technical interoperability rules in section 3 are the real breakthrough. Without shared telemetry and synchronization, multinational HVDC grids collapse during rapid solar fluctuations.',
    moderationStatus: 'approved',
    createdAt: '2026-09-21T09:12:00Z',
    language: 'en',
  },
  {
    id: 'comm-102',
    articleId: 'art-001',
    authorName: 'طارق الزهراني',
    content: 'هذا الاتفاق ينصف دول شمال إفريقيا والشرق الأوسط كشريك حقيقي ومصدر رئيسي للطاقة الشمسية النظيفة بدلاً من مجرد ممرات عبور. خطوة استراتيجية ممتازة.',
    moderationStatus: 'approved',
    createdAt: '2026-09-21T09:45:00Z',
    language: 'ar',
  },
  {
    id: 'comm-103',
    articleId: 'art-002',
    authorName: 'Claire Vaudreuil',
    content: 'L’inclusion de preuves à divulgation nulle de connaissance (ZKP) est fondamentale pour convaincre les banques d’investissement de migrer leurs flux.',
    moderationStatus: 'approved',
    createdAt: '2026-09-21T08:20:00Z',
    language: 'fr',
  },
  {
    id: 'comm-104',
    articleId: 'art-001',
    authorName: 'Anonymous Reader',
    content: 'Who will pay for the undersea cable maintenance in international waters if a major geological tremor occurs?',
    moderationStatus: 'pending',
    createdAt: '2026-09-21T10:30:00Z',
    language: 'en',
  },
  {
    id: 'comm-105',
    articleId: 'art-003',
    authorName: 'Mateo Morales',
    content: 'Excelente iniciativa al liberar los esquemas de hardware bajo licencias abiertas. La seguridad cuántica no debe depender de monopolios propietarios cerrados.',
    moderationStatus: 'approved',
    createdAt: '2026-09-21T07:10:00Z',
    language: 'es',
  },
];

export const INITIAL_AUTOMATION_LOGS: AutomationLog[] = [
  {
    id: 'log-001',
    jobType: 'rss_sync',
    source: 'Reuters World Wire Service',
    startedAt: '2026-09-21T10:00:00Z',
    completedAt: '2026-09-21T10:01:14Z',
    status: 'success',
    errorMessage: null,
    importedCount: 3,
  },
  {
    id: 'log-002',
    jobType: 'ai_editorial_generation',
    source: 'Gemini 3.8-Flash Multilingual Pipeline',
    startedAt: '2026-09-21T10:01:15Z',
    completedAt: '2026-09-21T10:02:40Z',
    status: 'success',
    errorMessage: null,
    importedCount: 3,
  },
  {
    id: 'log-003',
    jobType: 'sitemap_rebuild',
    source: 'System SEO Worker',
    startedAt: '2026-09-21T10:02:45Z',
    completedAt: '2026-09-21T10:02:50Z',
    status: 'success',
    errorMessage: null,
    importedCount: 0,
  },
  {
    id: 'log-004',
    jobType: 'rss_sync',
    source: 'France 24 International (Français)',
    startedAt: '2026-09-21T07:40:00Z',
    completedAt: '2026-09-21T07:40:48Z',
    status: 'success',
    errorMessage: null,
    importedCount: 2,
  },
  {
    id: 'log-005',
    jobType: 'rss_sync',
    source: 'AP Financial Ticker Feed',
    startedAt: '2026-09-21T06:00:00Z',
    completedAt: '2026-09-21T06:00:15Z',
    status: 'warning',
    errorMessage: 'Feed rate-limit notice received; throttled retry succeeded with 1 duplicate skipped.',
    importedCount: 1,
  },
];

export const INITIAL_SITE_SETTINGS: SiteSettings = {
  names: {
    en: 'News Discover',
    ar: 'نيوز ديسكفر',
    de: 'News Discover',
    es: 'News Discover',
    fr: 'News Discover',
  },
  descriptions: {
    en: 'Source-driven international news discovery with hourly updates and searchable coverage.',
    ar: 'منصة لاكتشاف الأخبار الدولية المستندة إلى المصادر مع تحديثات دورية وبحث سريع.',
    de: 'Quellenbasierte internationale Nachrichten mit regelmäßigen Updates und Suche.',
    es: 'Noticias internacionales basadas en fuentes con actualizaciones periódicas y búsqueda.',
    fr: 'Actualités internationales fondées sur les sources avec mises à jour régulières et recherche.',
  },
  logoText: 'NEWS DISCOVER',
  logoImage: '',
  faviconImage: '',
  homepageSeoTitle: 'News Discover | Latest International News',
  homepageSeoDescription: 'Source-driven international news discovery with hourly updates and searchable coverage.',
  homepageSeoKeywords: ['world news', 'international news', 'breaking news', 'politics', 'economy'],
  adsenseHeadCode: '',
  adsenseBodyCode: '',
  articlesPerSourcePerHour: 3,
  defaultLanguage: 'en',
  enabledLanguages: ['en'],
  primaryColor: '#0F172A',
  secondaryColor: '#475569',
  accentColor: '#0284C7',
  breakingColor: '#DC2626',
  contactInfo: {
    email: '',
    phone: '',
    address: '',
  },
  socialLinks: {
    twitter: '',
    facebook: '',
    linkedin: '',
    telegram: '',
    whatsapp: '',
  },
  footerText: {
    en: 'News Discover brings source-driven international news, original publisher metadata, and fast searchable coverage to readers worldwide.',
    ar: 'تقدم نيوز ديسكفر تغطية دولية حديثة ومحتوى إخبارياً مستنداً إلى المصادر الأصلية.',
    de: 'News Discover bietet aktuelle internationale Nachrichten und quellenbasierte Berichterstattung.',
    es: 'News Discover ofrece noticias internacionales actuales y cobertura basada en fuentes.',
    fr: 'News Discover propose des actualités internationales et une couverture fondée sur les sources.',
  },
  commentModeration: 'strict_approval',
  autoIngestEnabled: true,
  aiAssistanceEnabled: false,
  editorialStatement: {
    en: 'News Discover publishes source-derived news content and metadata without AI regeneration in the automated ingestion path. Source URLs and provenance are retained for verification, and publisher licensing terms remain applicable to source media.',
    ar: 'تعتمد نيوز ديسكفر في الاستيراد الآلي على المحتوى والبيانات الوصفية المستمدة من المصدر من دون إعادة صياغة بالذكاء الاصطناعي، مع الاحتفاظ ببيانات المصدر لأغراض التحقق.',
    de: 'News Discover veröffentlicht im automatisierten Import quellenbasierte Inhalte ohne KI-Neuschreibung und bewahrt die Herkunft zur Überprüfung.',
    es: 'News Discover publica contenido procedente de las fuentes sin reescritura por IA en la ingesta automática y conserva la procedencia para su verificación.',
    fr: 'News Discover publie des contenus issus des sources sans réécriture par IA dans l’ingestion automatique et conserve leur provenance pour vérification.',
  },
  siteUrl: 'https://www.newsdiscover.org',
  googleSearchConsoleVerification: '',
  googleAnalyticsMeasurementId: '',
};
