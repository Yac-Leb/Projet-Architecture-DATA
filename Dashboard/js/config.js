/* Constantes globales et état mutable partagé entre tous les modules. */

export const API = "http://localhost:8000";

export const RAMPE = ["#1a9850", "#91cf60", "#d9ef8b", "#fee08b", "#fc8d59", "#d73027"];

export const COULEURS_PIECES = {
    "Studio/T1": "#0aa1a8",
    "T2":        "#3aafc9",
    "T3":        "#f5b841",
    "T4+":       "#e3611a",
};

export const COULEURS_SOURCE = {
    "Fontaine à boire":       "#1d6fb8",
    "Espace vert frais":      "#2e9e5b",
    "Équipement fraîcheur":   "#f5a623",
    "Commerce eau de Paris":  "#00939c",
};

export const COULEURS_MODE = {
    metro: "#1A3EBF",
    rer:   "#9B2335",
    bus:   "#5DAA46",
    tram:  "#D46E00",
    autre: "#888888",
};

export const MODES_LABEL = {
    metro: "🚇 Métro",
    rer:   "🚄 RER",
    bus:   "🚌 Bus",
    tram:  "🚊 Tram",
    autre: "🚠 Autre",
};

export const CATEGORIES = {
    petillante: { label: "Eau pétillante",    color: "#f5a623", icon: "🥤" },
    brumisation: { label: "Avec brumisation", color: "#37c0e0", icon: "🌫️" },
    plate:       { label: "Eau plate",         color: "#1d6fb8", icon: "💧" },
};

export const CAT_HORS = {
    cle: "hors", label: "Hors service", color: "#9aa3af", icon: "○",
};

export const CAT_COMMERCE = {
    cle: "commerce", label: "Commerce Eau de Paris", color: "#00939c", icon: "🏪",
};

export const TYPES_FONTAINE = {
    FONTAINE_BOIS:    "Fontaine en fonte",
    FONTNE_WALLACE:   "Fontaine Wallace",
    FONTAINE_2EN1:    "Fontaine 2-en-1",
    FONTAINE_ARCEAU:  "Fontaine arceau",
    BORNE_FONTAINE:   "Borne-fontaine",
    FTNE_PETILLANTE:  "Fontaine pétillante",
};

export const TABLES = [
    "prix_m2", "types_logements", "pieces", "accessibilite",
    "logements_sociaux", "logements_sociaux_part", "fraicheur",
    "transport", "marches", "tension",
];

// État mutable partagé — tous les modules lisent et écrivent via etat.xxx
export const etat = {
    // Carte
    GEO:              null,
    map:              null,
    popupHover:       null,
    carteReady:       false,
    indicateurCourant: "prix_m2",
    arrActif:         1,
    anneeActive:      null,
    annees:           [],
    paliers:          [],
    DATA:             {},
    // Graphiques comparaison
    chartPrix:        null,
    chartComposites:  null,
    // Couche fontaines + commerces eau
    fontainesData:    null,
    commerceData:     null,
    fontainesPretes:  false,
    fontainesLegende: null,
    catVisible: {
        plate: true, brumisation: true, petillante: true, hors: true, commerce: true,
    },
    // Couche fraîcheur
    fraicheurData:  null,
    fraicheurPrete: false,
    // Couche marchés
    marchesData:   null,
    marchesPrets:  false,
    // Couche transport
    transportData:        null,
    transportPrets:       false,
    catVisibleTransport: {
        metro: true, rer: true, bus: true, tram: true, autre: true,
    },
};
