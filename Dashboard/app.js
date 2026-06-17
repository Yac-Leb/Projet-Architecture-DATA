/* Urban Data Explorer — dashboard Leaflet premium.
   Consomme l'API FastAPI (schéma gold). */

const API = "http://localhost:8000";
const RAMPE = ["#1a9850", "#91cf60", "#d9ef8b", "#fee08b", "#fc8d59", "#d73027"];
const COULEURS_PIECES = { "Studio/T1": "#0aa1a8", "T2": "#3aafc9", "T3": "#f5b841", "T4+": "#e3611a" };
const COULEURS_SOURCE = {
  "Fontaine à boire": "#1d6fb8", "Espace vert frais": "#2e9e5b",
  "Équipement fraîcheur": "#f5a623", "Commerce eau de Paris": "#00939c",
};

// Indicateurs cartographiables (1 valeur/arrondissement). desc=true : valeur haute = "mieux/plus".
const INDICATEURS_CARTE = {
  prix_m2: { label: "Prix médian au m²", unite: "€/m²", icon: "🏠",
    valeur: (a) => { const l = ligneAnnee(DATA.prix_m2[a], anneeActive); return l ? l.prix_m2_median : null; } },
  logements_sociaux_part: { label: "Part de logements sociaux", unite: "%", icon: "🏢",
    valeur: (a) => premier(DATA.logements_sociaux_part[a], "part_logements_sociaux_pct") },
  accessibilite: { label: "Accessibilité (m²/an de revenu)", unite: "m²", icon: "💶",
    valeur: (a) => premier(DATA.accessibilite[a], "m2_par_revenu_annuel") },
  fraicheur: { label: "Fraîcheur urbaine", unite: "pts", icon: "🌳",
    valeur: (a) => premier(DATA.fraicheur[a], "nb_total_fraicheur") },
  transport: { label: "Arrêts de transport", unite: "", icon: "🚇",
    valeur: (a) => premier(DATA.transport[a], "nb_total_arrets") },
  marches: { label: "Marchés alimentaires", unite: "", icon: "🥕",
    valeur: (a) => premier(DATA.marches[a], "nb_marches") },
  tension: { label: "Tension (rendement locatif)", unite: "%", icon: "📈",
    valeur: (a) => premier(DATA.tension[a], "rendement_locatif_pct") },
};

const TABLES = ["prix_m2", "types_logements", "pieces", "accessibilite",
  "logements_sociaux", "logements_sociaux_part", "fraicheur", "transport", "marches", "tension"];

const DATA = {};
let GEO = null, map = null, popupHover = null, carteReady = false;
let indicateurCourant = "prix_m2", arrActif = 1, anneeActive = null, annees = [], paliers = [];
let chartPrix = null, chartComposites = null;
let fontainesData = null, commerceData = null, fontainesPretes = false, fontainesLegende = null;
const catVisible = { plate: true, brumisation: true, petillante: true, hors: true, commerce: true };
let fraicheurData = null, fraicheurPrete = false;
let marchesData = null, marchesPrets = false;
let transportData = null, transportPrets = false;
const COULEURS_MODE = { metro: "#1A3EBF", rer: "#9B2335", bus: "#5DAA46", tram: "#D46E00", autre: "#888888" };
const MODES_LABEL = { metro: "🚇 Métro", rer: "🚄 RER", bus: "🚌 Bus", tram: "🚊 Tram", autre: "🚠 Autre" };
const catVisibleTransport = { metro: true, rer: true, bus: true, tram: true, autre: true };

const CAT_HORS = { cle: "hors", label: "Hors service", color: "#9aa3af", icon: "○" };
const CAT_COMMERCE = { cle: "commerce", label: "Commerce Eau de Paris", color: COULEURS_SOURCE["Commerce eau de Paris"], icon: "🏪" };
const CATEGORIES = {
  petillante: { label: "Eau pétillante", color: "#f5a623", icon: "🥤" },
  brumisation: { label: "Avec brumisation", color: "#37c0e0", icon: "🌫️" },
  plate: { label: "Eau plate", color: "#1d6fb8", icon: "💧" },
};
function categorieFontaine(f) {
  if (!f.disponible) return CAT_HORS;
  if (f.type === "FTNE_PETILLANTE") return { cle: "petillante", ...CATEGORIES.petillante };
  if (f.type === "FONTAINE_2EN1") return { cle: "brumisation", ...CATEGORIES.brumisation };
  return { cle: "plate", ...CATEGORIES.plate };
}

// ---------- Utils ----------
function premier(l, c) { return l && l.length ? l[0][c] : null; }
function ligneAnnee(l, an) { return (l || []).find((x) => x.annee === an) || null; }
function anneeMax(code) { const l = DATA.prix_m2[code] || []; return l.length ? Math.max(...l.map((x) => x.annee)) : null; }
function nomArr(code) { const f = GEO.features.find((x) => x.properties.code_arrondissement === code); return f?.properties.nom || `Arrondissement ${code}`; }
function fmt(v, u) { if (v === null || v === undefined) return "—"; const n = typeof v === "number" ? Math.round(v).toLocaleString("fr-FR") : v; return u ? `${n} ${u}` : `${n}`; }
function fmt1(v, u) { if (v === null || v === undefined) return "—"; const n = typeof v === "number" ? v.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : v; return u ? `${n} ${u}` : `${n}`; }
function setStatus(m, err) { const e = document.getElementById("status"); if (!m) { e.classList.add("hidden"); return; } e.textContent = m; e.classList.remove("hidden"); e.classList.toggle("error", !!err); }
function codes() { return GEO.features.map((f) => f.properties.code_arrondissement); }

// valeurs d'un indicateur sur tous les arrondissements
function toutesValeurs(fn) { return codes().map((c) => fn(c)).filter((v) => v !== null && v !== undefined); }
function mediane(arr) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
// rang (1 = plus élevé) parmi les 20
function rang(code, fn) {
  const v = fn(code); if (v == null) return null;
  const vals = toutesValeurs(fn).sort((a, b) => b - a);
  return vals.indexOf(v) + 1;
}
function ordinal(n) { return n === 1 ? "1ᵉʳ" : n + "ᵉ"; }

// ---------- Chargement ----------
async function chargerDonnees() {
  try {
    const geoP = fetch(`${API}/arrondissements`).then((r) => r.json());
    const tP = TABLES.map((t) => fetch(`${API}/indicateurs/${t}`).then((r) => r.json()));
    const [geo, ...tables] = await Promise.all([geoP, ...tP]);
    GEO = geo;
    TABLES.forEach((t, i) => { DATA[t] = {}; for (const ligne of tables[i]) { const c = ligne.code_arrondissement; (DATA[t][c] = DATA[t][c] || []).push(ligne); } });
    annees = [...new Set(Object.values(DATA.prix_m2).flat().map((l) => l.annee))].sort();
    anneeActive = annees[annees.length - 1];
    setStatus(null);
    initInterface();
  } catch (e) {
    setStatus("Impossible de joindre l'API (http://localhost:8000). Vérifiez le service 'api' et l'exécution des pipelines.", true);
    console.error(e);
  }
}

// ---------- Couleurs ----------
function calculerPaliers() {
  const cfg = INDICATEURS_CARTE[indicateurCourant];
  const vals = toutesValeurs(cfg.valeur).sort((a, b) => a - b);
  const s = []; for (let i = 1; i < RAMPE.length; i++) s.push(vals[Math.floor((vals.length - 1) * (i / RAMPE.length))]);
  return s;
}
function couleur(v) { if (v == null) return "#cccccc"; for (let i = 0; i < paliers.length; i++) if (v <= paliers[i]) return RAMPE[i]; return RAMPE[RAMPE.length - 1]; }

// ---------- Carte (MapLibre GL) ----------
function initCarte() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [2.345, 48.857],
    zoom: 11.3,
    minZoom: 10,
    maxZoom: 19,
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: true }), "top-right");
  popupHover = new maplibregl.Popup({ closeButton: true, closeOnClick: false, closeOnMove: false, className: "arr-tooltip-wrap", offset: 14, maxWidth: "none" });

  map.on("load", () => {
    ajouterCouchesArr();
    carteReady = true;
    paliers = calculerPaliers();
    rafraichirCarte();
    setArrActif(arrActif, false);
  });
}

// Couches arrondissements : remplissage choroplèthe + bordures + contour actif
function ajouterCouchesArr() {
  map.addSource("arr", { type: "geojson", data: GEO, promoteId: "code_arrondissement" });

  map.addLayer({
    id: "arr-fill", type: "fill", source: "arr",
    paint: {
      "fill-color": ["coalesce", ["get", "_couleur"], "#cccccc"],
      "fill-opacity": ["case", ["==", ["get", "_actif"], 1], 0.72, 0.55],
    },
  });
  map.addLayer({
    id: "arr-line", type: "line", source: "arr",
    paint: { "line-color": "#ffffff", "line-width": 1.4 },
  });
  map.addLayer({
    id: "arr-line-active", type: "line", source: "arr",
    filter: ["==", ["get", "_actif"], 1],
    paint: { "line-color": "#0f1b2d", "line-width": 3.5 },
  });

  // Interactions : le clic affiche la carte d'infos (popup épinglé) + remplit le panneau de droite
  map.on("mouseenter", "arr-fill", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "arr-fill", () => { map.getCanvas().style.cursor = ""; });
  map.on("click", "arr-fill", (e) => {
    if (!e.features.length) return;
    const pointLayers = ["transport-pt", "marches-pt", "fontaines-pt", "fraicheur-point", "fraicheur-cluster"]
      .filter((id) => !!map.getLayer(id));
    if (pointLayers.length && map.queryRenderedFeatures(e.point, { layers: pointLayers }).length > 0) return;
    const code = e.features[0].properties.code_arrondissement;
    setArrActif(code, true);
    popupHover.setLngLat(e.lngLat).setHTML(tooltipHTML(code)).addTo(map);
  });
}

// Infobulle riche au survol
function tooltipHTML(code) {
  const prix = ligneAnnee(DATA.prix_m2[code], anneeActive), ev = prix?.evolution_pct;
  const trend = ev == null ? "" : `<span class="tt-trend ${ev > 0 ? "up" : "down"}">${ev > 0 ? "▲" : "▼"} ${Math.abs(ev)}%</span>`;
  const part = premier(DATA.logements_sociaux_part[code], "part_logements_sociaux_pct");
  const fr = premier(DATA.fraicheur[code], "nb_total_fraicheur");
  const tr = premier(DATA.transport[code], "nb_total_arrets");
  const ma = premier(DATA.marches[code], "nb_marches");
  return `<div class="tt-head">
      <div class="tt-nom">${nomArr(code)}</div>
      <div class="tt-prix"><b>${fmt(prix?.prix_m2_median)} €/m²</b>${trend}</div>
    </div>
    <div class="tt-grid">
      <div class="tt-cell"><div class="l">🏢 Logts sociaux</div><div class="v">${fmt1(part, "%")}</div></div>
      <div class="tt-cell"><div class="l">🌳 Fraîcheur</div><div class="v">${fmt(fr)}</div></div>
      <div class="tt-cell"><div class="l">🚇 Arrêts</div><div class="v">${fmt(tr)}</div></div>
      <div class="tt-cell"><div class="l">🥕 Marchés</div><div class="v">${fmt(ma)}</div></div>
    </div>
    <div class="tt-foot">Détail complet dans le panneau de droite →</div>`;
}

function rafraichirCarte() {
  if (!carteReady) return;
  const estFraicheur = indicateurCourant === "fraicheur";
  majModeFraicheur(estFraicheur);
  if (!estFraicheur) paliers = calculerPaliers();

  // Injecte couleur + état actif dans les propriétés des features, puis re-source
  GEO.features.forEach((f) => {
    const code = f.properties.code_arrondissement;
    const v = estFraicheur ? null : INDICATEURS_CARTE[indicateurCourant].valeur(code);
    f.properties._couleur = estFraicheur ? "rgba(0,0,0,0)" : couleur(v);
    f.properties._actif = code === arrActif ? 1 : 0;
  });
  map.getSource("arr").setData(GEO);
  map.setFilter("arr-line-active", ["==", ["get", "_actif"], 1]);
  majLegende();
}

// ---------- Légende carte (div ancré dans .map-wrap) ----------
function paliersHTML() {
  let html = "", bas = -Infinity;
  for (let i = 0; i < RAMPE.length; i++) {
    const haut = i < paliers.length ? paliers[i] : Infinity;
    const label = haut === Infinity ? `> ${Math.round(paliers[paliers.length - 1]).toLocaleString("fr-FR")}`
      : `${bas === -Infinity ? "≤" : Math.round(bas).toLocaleString("fr-FR") + "–"} ${Math.round(haut).toLocaleString("fr-FR")}`;
    html += `<div class="row" style="display:flex;align-items:center;gap:7px;margin:2px 0"><span style="width:24px;height:11px;border-radius:3px;background:${RAMPE[i]}"></span>${label}</div>`;
    bas = haut;
  }
  return html;
}
function sourcesHTML() {
  return Object.entries(COULEURS_SOURCE).map(([s, c]) =>
    `<div class="row" style="display:flex;align-items:center;gap:7px;margin:2px 0"><span style="width:13px;height:13px;border-radius:50%;background:${c}"></span>${s}</div>`).join("");
}
function majLegende() {
  const m = document.getElementById("legende-map"); if (!m) return;
  const cfg = INDICATEURS_CARTE[indicateurCourant];
  const titre = indicateurCourant === "fraicheur" ? "Points de fraîcheur" : cfg.label + (cfg.unite ? ` (${cfg.unite})` : "");
  const corps = indicateurCourant === "fraicheur" ? sourcesHTML() : paliersHTML();
  m.innerHTML = `<div class="legende-titre">${titre}</div>${corps}`;
  m.classList.remove("hidden");
}

// ---------- Cluster fraîcheur (clustering natif MapLibre) ----------
const LAYERS_FRAICHEUR = ["fraicheur-cluster", "fraicheur-count", "fraicheur-point"];

function majModeFraicheur(actif) {
  if (actif) { construireFraicheur(); }
  else if (fraicheurPrete) LAYERS_FRAICHEUR.forEach((l) => map.setLayoutProperty(l, "visibility", "none"));
}

async function construireFraicheur() {
  if (!fraicheurPrete) {
    if (!fraicheurData) {
      try { fraicheurData = await fetch(`${API}/fraicheur_points`).then((r) => r.json()); }
      catch (e) { console.error(e); return; }
    }
    const fc = {
      type: "FeatureCollection",
      features: fraicheurData.filter((p) => p.lat != null && p.lon != null).map((p) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [p.lon, p.lat] },
        properties: { source: p.source || "", nom: p.nom || "", arr: p.code_arrondissement ?? "—" },
      })),
    };
    map.addSource("fraicheur", { type: "geojson", data: fc, cluster: true, clusterRadius: 50, clusterMaxZoom: 15 });

    map.addLayer({
      id: "fraicheur-cluster", type: "circle", source: "fraicheur", filter: ["has", "point_count"],
      paint: {
        "circle-color": ["step", ["get", "point_count"], "#7fc7ec", 25, "#3aa0e0", 75, "#1d6fb8"],
        "circle-radius": ["step", ["get", "point_count"], 16, 25, 22, 75, 30],
        "circle-opacity": 0.85, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff",
      },
    });
    map.addLayer({
      id: "fraicheur-count", type: "symbol", source: "fraicheur", filter: ["has", "point_count"],
      layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 13, "text-font": ["Noto Sans Bold"] },
      paint: { "text-color": "#ffffff" },
    });
    map.addLayer({
      id: "fraicheur-point", type: "circle", source: "fraicheur", filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["match", ["get", "source"],
          "Fontaine à boire", COULEURS_SOURCE["Fontaine à boire"],
          "Espace vert frais", COULEURS_SOURCE["Espace vert frais"],
          "Équipement fraîcheur", COULEURS_SOURCE["Équipement fraîcheur"],
          "Commerce eau de Paris", COULEURS_SOURCE["Commerce eau de Paris"],
          "#1d6fb8"],
        "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff",
      },
    });

    // Zoom sur clic d'un cluster + popup sur point isolé
    map.on("click", "fraicheur-cluster", (e) => {
      const id = e.features[0].properties.cluster_id;
      map.getSource("fraicheur").getClusterExpansionZoom(id).then((z) => {
        map.easeTo({ center: e.features[0].geometry.coordinates, zoom: z });
      });
    });
    map.on("click", "fraicheur-point", (e) => {
      const p = e.features[0].properties, col = COULEURS_SOURCE[p.source] || "#1d6fb8";
      new maplibregl.Popup({ offset: 12 }).setLngLat(e.features[0].geometry.coordinates)
        .setHTML(`<div class="fpopup"><div class="fpopup-cat" style="color:${col}">${p.source}</div><div class="fpopup-adr">${p.nom || ""}</div><div class="fpopup-meta">Arr. ${p.arr}</div></div>`)
        .addTo(map);
    });
    ["fraicheur-cluster", "fraicheur-point"].forEach((l) => {
      map.on("mouseenter", l, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", l, () => { map.getCanvas().style.cursor = ""; });
    });
    fraicheurPrete = true;
  }
  LAYERS_FRAICHEUR.forEach((l) => map.setLayoutProperty(l, "visibility", "visible"));
}

// ---------- Fontaines (source GeoJSON + couche circle filtrable) ----------
const TYPES_FONTAINE = { FONTAINE_BOIS: "Fontaine en fonte", FONTNE_WALLACE: "Fontaine Wallace", FONTAINE_2EN1: "Fontaine 2-en-1", FONTAINE_ARCEAU: "Fontaine arceau", BORNE_FONTAINE: "Borne-fontaine", FTNE_PETILLANTE: "Fontaine pétillante" };

async function toggleFontaines(on) {
  const leg = document.getElementById("fontaines-legende");
  if (!on) { if (fontainesPretes) map.setLayoutProperty("fontaines-pt", "visibility", "none"); leg.classList.add("hidden"); return; }
  if (!fontainesData) { try { fontainesData = await fetch(`${API}/fontaines`).then((r) => r.json()); } catch (e) { console.error(e); return; } }
  if (!commerceData) {
    try {
      const pts = fraicheurData || await fetch(`${API}/fraicheur_points`).then((r) => r.json());
      if (!fraicheurData) fraicheurData = pts;
      commerceData = pts.filter((p) => p.source === "Commerce eau de Paris");
    } catch (e) { console.error(e); commerceData = []; }
  }
  if (!fontainesPretes) construireFontaines();
  map.setLayoutProperty("fontaines-pt", "visibility", "visible");
  appliquerFiltreFontaines();
  majLegendeFontaines(); leg.classList.remove("hidden");
}
function construireFontaines() {
  fontainesLegende = {};
  const compter = (c) => { fontainesLegende[c.cle] = fontainesLegende[c.cle] || { label: c.label, color: c.color, icon: c.icon, n: 0 }; fontainesLegende[c.cle].n++; };

  const featFontaine = (f) => {
    const cat = categorieFontaine(f); compter(cat);
    return { type: "Feature", geometry: { type: "Point", coordinates: [f.lon, f.lat] },
      properties: {
        cat: cat.cle, color: cat.color, catLabel: cat.label, catIcon: cat.icon,
        typeLabel: TYPES_FONTAINE[f.type] || f.type || "Fontaine",
        adresse: f.adresse || "", arr: f.code_arrondissement ?? "—", modele: f.modele || "—",
        statut: f.disponible ? "<b style='color:#1e8e54'>● En service</b>" : "<b style='color:#d64545'>● Hors service</b>",
      } };
  };
  const featCommerce = (p) => {
    compter(CAT_COMMERCE);
    return { type: "Feature", geometry: { type: "Point", coordinates: [p.lon, p.lat] },
      properties: {
        cat: CAT_COMMERCE.cle, color: CAT_COMMERCE.color, catLabel: CAT_COMMERCE.label, catIcon: CAT_COMMERCE.icon,
        typeLabel: "Point d'eau partenaire Eau de Paris",
        adresse: p.nom || "", arr: p.code_arrondissement ?? "—", modele: "", statut: "",
      } };
  };

  const features = [
    ...fontainesData.filter((f) => f.lat != null && f.lon != null).map(featFontaine),
    ...(commerceData || []).filter((p) => p.lat != null && p.lon != null).map(featCommerce),
  ];
  map.addSource("fontaines", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({
    id: "fontaines-pt", type: "circle", source: "fontaines",
    layout: { visibility: "none" },
    paint: { "circle-color": ["get", "color"], "circle-radius": 5, "circle-stroke-width": 1.5, "circle-stroke-color": "#ffffff" },
  });
  map.on("click", "fontaines-pt", (e) => {
    const p = e.features[0].properties;
    const meta = `Arr. ${p.arr}${p.modele ? " · " + p.modele : ""}`;
    new maplibregl.Popup({ offset: 12 }).setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<div class="fpopup"><div class="fpopup-cat" style="color:${p.color}">${p.catIcon} ${p.catLabel}</div>
        <div class="fpopup-type">${p.typeLabel}</div><div class="fpopup-adr">${p.adresse}</div>
        <div class="fpopup-meta">${meta}</div>
        ${p.statut ? `<div class="fpopup-statut">${p.statut}</div>` : ""}</div>`).addTo(map);
  });
  map.on("mouseenter", "fontaines-pt", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "fontaines-pt", () => { map.getCanvas().style.cursor = ""; });
  fontainesPretes = true;
}
function appliquerFiltreFontaines() {
  if (!fontainesPretes) return;
  const visibles = Object.keys(catVisible).filter((c) => catVisible[c]);
  map.setFilter("fontaines-pt", ["in", ["get", "cat"], ["literal", visibles]]);
}
function toggleCategorieFontaine(cle) {
  if (!fontainesPretes) return;
  catVisible[cle] = !catVisible[cle];
  appliquerFiltreFontaines();
  majLegendeFontaines();
}
function majLegendeFontaines() {
  if (!fontainesLegende) return;
  const ordre = ["plate", "brumisation", "petillante", "hors", "commerce"];
  const rows = ordre.filter((k) => fontainesLegende[k]).map((k) => { const c = fontainesLegende[k];
    return `<div class="frow ${catVisible[k] ? "" : "off"}" data-cle="${k}" title="Afficher / masquer"><span class="fdot" style="background:${c.color}"></span><span class="flabel">${c.icon} ${c.label}</span><span class="fn">${c.n}</span></div>`; }).join("");
  const box = document.getElementById("fontaines-legende");
  box.innerHTML = `<div class="fleg-titre">Points d'eau</div>${rows}<div class="fleg-note">Cliquez une catégorie pour l'afficher/masquer · cliquez un point pour ses détails</div>`;
  box.querySelectorAll(".frow[data-cle]").forEach((el) => el.addEventListener("click", () => toggleCategorieFontaine(el.dataset.cle)));
}

// ---------- Marchés alimentaires ----------
async function toggleMarches(on) {
  if (!on) { if (marchesPrets) map.setLayoutProperty("marches-pt", "visibility", "none"); return; }
  if (!marchesData) {
    try { marchesData = await fetch(`${API}/marches_points`).then((r) => r.json()); }
    catch (e) { console.error(e); return; }
  }
  if (!marchesPrets) construireMarches();
  map.setLayoutProperty("marches-pt", "visibility", "visible");
}
function construireMarches() {
  const features = marchesData.filter((m) => m.lat != null && m.lon != null).map((m) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [m.lon, m.lat] },
    properties: { nom: m.nom || "Marché", jours: m.jours || "", arr: m.code_arrondissement ?? "—" },
  }));
  map.addSource("marches-src", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({
    id: "marches-pt", type: "circle", source: "marches-src",
    layout: { visibility: "none" },
    paint: { "circle-color": "#e3611a", "circle-radius": 7, "circle-stroke-width": 2, "circle-stroke-color": "#ffffff" },
  });
  map.on("click", "marches-pt", (e) => {
    const p = e.features[0].properties;
    new maplibregl.Popup({ offset: 12 }).setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<div class="fpopup"><div class="fpopup-cat" style="color:#e3611a">🥕 Marché alimentaire</div>
        <div class="fpopup-type">${p.nom}</div>
        ${p.jours ? `<div class="fpopup-adr">📅 ${p.jours}</div>` : ""}
        <div class="fpopup-meta">Arr. ${p.arr}</div></div>`).addTo(map);
  });
  map.on("mouseenter", "marches-pt", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "marches-pt", () => { map.getCanvas().style.cursor = ""; });
  marchesPrets = true;
}

// ---------- Arrêts de transport ----------
async function toggleTransport(on) {
  const leg = document.getElementById("transport-legende");
  if (!on) { if (transportPrets) map.setLayoutProperty("transport-pt", "visibility", "none"); leg.classList.add("hidden"); return; }
  if (!transportData) {
    try { transportData = await fetch(`${API}/transport_points`).then((r) => r.json()); }
    catch (e) { console.error(e); return; }
  }
  if (!transportPrets) construireTransport();
  map.setLayoutProperty("transport-pt", "visibility", "visible");
  appliquerFiltreTransport();
  majLegendeTransport(); leg.classList.remove("hidden");
}
function construireTransport() {
  const features = transportData.filter((t) => t.lat != null && t.lon != null).map((t) => ({
    type: "Feature",
    geometry: { type: "Point", coordinates: [t.lon, t.lat] },
    properties: { nom: t.nom || "", mode: (t.mode || "bus").toLowerCase(), arr: t.code_arrondissement ?? "—",
      color: COULEURS_MODE[(t.mode || "bus").toLowerCase()] || "#888" },
  }));
  map.addSource("transport-src", { type: "geojson", data: { type: "FeatureCollection", features } });
  map.addLayer({
    id: "transport-pt", type: "circle", source: "transport-src",
    layout: { visibility: "none" },
    paint: { "circle-color": ["get", "color"], "circle-radius": 4, "circle-stroke-width": 1.2, "circle-stroke-color": "#ffffff", "circle-opacity": 0.85 },
  });
  map.on("click", "transport-pt", (e) => {
    const p = e.features[0].properties;
    const col = COULEURS_MODE[p.mode] || "#888";
    const label = MODES_LABEL[p.mode] || p.mode;
    new maplibregl.Popup({ offset: 10 }).setLngLat(e.features[0].geometry.coordinates)
      .setHTML(`<div class="fpopup"><div class="fpopup-cat" style="color:${col}">${label}</div>
        <div class="fpopup-type">${p.nom}</div>
        <div class="fpopup-meta">Arr. ${p.arr}</div></div>`).addTo(map);
  });
  map.on("mouseenter", "transport-pt", () => { map.getCanvas().style.cursor = "pointer"; });
  map.on("mouseleave", "transport-pt", () => { map.getCanvas().style.cursor = ""; });
  transportPrets = true;
}
function appliquerFiltreTransport() {
  if (!transportPrets) return;
  const visibles = Object.keys(catVisibleTransport).filter((m) => catVisibleTransport[m]);
  map.setFilter("transport-pt", ["in", ["get", "mode"], ["literal", visibles]]);
}
function toggleModeTransport(mode) {
  catVisibleTransport[mode] = !catVisibleTransport[mode];
  appliquerFiltreTransport();
  majLegendeTransport();
}
function majLegendeTransport() {
  if (!transportPrets) return;
  const comptage = {};
  for (const t of transportData) { const m = (t.mode || "bus").toLowerCase(); comptage[m] = (comptage[m] || 0) + 1; }
  const rows = Object.keys(MODES_LABEL).filter((m) => comptage[m]).map((m) =>
    `<div class="frow ${catVisibleTransport[m] ? "" : "off"}" data-mode="${m}" title="Afficher / masquer">
      <span class="fdot" style="background:${COULEURS_MODE[m]}"></span>
      <span class="flabel">${MODES_LABEL[m]}</span>
      <span class="fn">${comptage[m]}</span></div>`).join("");
  const box = document.getElementById("transport-legende");
  box.innerHTML = `<div class="fleg-titre">Modes de transport</div>${rows}<div class="fleg-note">Cliquez un mode pour l'afficher/masquer</div>`;
  box.querySelectorAll(".frow[data-mode]").forEach((el) => el.addEventListener("click", () => toggleModeTransport(el.dataset.mode)));
}

// ---------- Panneau détail (droite) ----------
// Bbox d'une feature Polygon/MultiPolygon → [[minLng,minLat],[maxLng,maxLat]]
function bboxFeature(feature) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  const parcourir = (coords) => {
    if (typeof coords[0] === "number") {
      const [lng, lat] = coords;
      if (lng < minLng) minLng = lng; if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng; if (lat > maxLat) maxLat = lat;
    } else coords.forEach(parcourir);
  };
  parcourir(feature.geometry.coordinates);
  return [[minLng, minLat], [maxLng, maxLat]];
}

function setArrActif(code, pan) {
  arrActif = code;
  document.getElementById("select-arr").value = code;
  if (carteReady && map.getSource("arr")) {
    GEO.features.forEach((f) => { f.properties._actif = f.properties.code_arrondissement === code ? 1 : 0; });
    map.getSource("arr").setData(GEO);
    map.setFilter("arr-line-active", ["==", ["get", "_actif"], 1]);
    if (pan) {
      const f = GEO.features.find((x) => x.properties.code_arrondissement === code);
      if (f) map.fitBounds(bboxFeature(f), { padding: 40, maxZoom: 13, duration: 600 });
    }
  }
  majDetail();
}

function sparkline(values) {
  const vals = values.filter((v) => v != null); if (vals.length < 2) return "";
  const w = 300, h = 34, min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const pts = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - 4 - ((v - min) / span) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const last = values[values.length - 1], first = values[0];
  const col = last >= first ? "#d64545" : "#1e8e54";
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
    <polyline points="${pts}" fill="none" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
}

function carteKPI(icon, label, valeurHTML, footHTML, spark) {
  return `<div class="kpi">
    <div class="kpi-top"><span class="kpi-ic">${icon}</span><span class="kpi-label">${label}</span></div>
    <div class="kpi-main">${valeurHTML}</div>
    ${footHTML ? `<div class="kpi-foot">${footHTML}</div>` : ""}
    ${spark || ""}
  </div>`;
}

function majDetail() {
  const code = arrActif;
  const prix = ligneAnnee(DATA.prix_m2[code], anneeActive), ev = prix?.evolution_pct;
  const valPrix = (c) => ligneAnnee(DATA.prix_m2[c], anneeActive)?.prix_m2_median;
  const rPrix = rang(code, valPrix), medParis = mediane(toutesValeurs(valPrix));
  const part = premier(DATA.logements_sociaux_part[code], "part_logements_sociaux_pct");
  const acc = premier(DATA.accessibilite[code], "m2_par_revenu_annuel");
  const tens = premier(DATA.tension[code], "rendement_locatif_pct");
  const fr = premier(DATA.fraicheur[code], "nb_total_fraicheur");
  const tr = premier(DATA.transport[code], "nb_total_arrets");
  const ma = premier(DATA.marches[code], "nb_marches");

  // En-tête
  const head = `<div class="detail-head">
    <div class="dh-arr">${nomArr(code)}</div>
    <div class="dh-sub">Paris · données ${anneeActive}</div>
    <div class="dh-tags">
      <span class="dh-tag">🏠 ${ordinal(rPrix)}/20 le plus cher</span>
      <span class="dh-tag">🌳 ${fmt(fr)} pts fraîcheur</span>
      <span class="dh-tag">🚇 ${fmt(tr)} arrêts</span>
    </div></div>`;

  // KPI prix avec badge + contexte + sparkline
  const badge = ev == null ? `<span class="badge flat">n/a</span>`
    : `<span class="badge ${ev > 0 ? "up" : "down"}">${ev > 0 ? "▲" : "▼"} ${Math.abs(ev)} % vs ${anneeActive - 1}</span>`;
  const ctxPrix = `<span class="kpi-ctx">${ordinal(rPrix)}/20 · médiane Paris ${fmt(medParis)} €</span>`;
  const serie = annees.map((an) => ligneAnnee(DATA.prix_m2[code], an)?.prix_m2_median ?? null);
  const kpiPrix = carteKPI("🏠", `Prix médian au m² (${anneeActive})`,
    `<span class="kpi-value">${fmt(prix?.prix_m2_median)}</span><span class="kpi-unit">€/m²</span>`,
    `${badge}${ctxPrix}`, sparkline(serie));

  const kpiSocial = carteKPI("🏢", "Part de logements sociaux",
    `<span class="kpi-value">${fmt1(part)}</span><span class="kpi-unit">%</span>`,
    `<span class="kpi-ctx">${ordinal(rang(code, (c) => premier(DATA.logements_sociaux_part[c], "part_logements_sociaux_pct")))}/20</span>`);

  const kpiAcc = carteKPI("💶", "Accessibilité",
    `<span class="kpi-value">${fmt1(acc)}</span><span class="kpi-unit">m²/an de revenu</span>`,
    `<span class="kpi-ctx">surface achetable avec 1 an de revenu médian</span>`);

  const kpiTens = carteKPI("📈", "Tension immobilière",
    `<span class="kpi-value">${fmt1(tens)}</span><span class="kpi-unit">% rendement locatif</span>`,
    `<span class="kpi-ctx">plus c'est bas, plus la tension est forte</span>`);

  // Distribution par pièces
  const pieces = (DATA.pieces[code] || []).slice().sort((a, b) =>
    ["Studio/T1", "T2", "T3", "T4+"].indexOf(a.categorie) - ["Studio/T1", "T2", "T3", "T4+"].indexOf(b.categorie));
  const segs = pieces.map((p) => `<div class="distrib-seg" style="flex:${p.part_pct};background:${COULEURS_PIECES[p.categorie] || "#999"}" title="${p.categorie} ${p.part_pct}%">${p.part_pct >= 9 ? p.part_pct + "%" : ""}</div>`).join("");
  const legPieces = pieces.map((p) => `<div class="row"><span class="swatch" style="background:${COULEURS_PIECES[p.categorie] || "#999"}"></span>${p.categorie} ${p.part_pct}%</div>`).join("");
  const maison = (DATA.types_logements[code] || []).find((t) => t.type_local === "Maison");
  const distrib = `<div class="distrib-card"><h4>Répartition par nombre de pièces</h4>
    <div class="distrib-bar">${segs}</div>
    <div class="distrib-legend">${legPieces}</div>
    <div class="distrib-extra">${maison ? `🏡 Maisons : ${maison.part_pct}% des biens` : "🏡 Maisons : &lt;1% (Paris intra-muros)"}</div></div>`;

  document.getElementById("detail").innerHTML = head + kpiPrix + kpiSocial + kpiAcc + kpiTens + distrib;
}

// ---------- Timeline ----------
function majAnnee(idx) {
  anneeActive = annees[idx];
  document.getElementById("annee-label").textContent = anneeActive;
  document.getElementById("annee-slider").value = idx;
  if (indicateurCourant === "prix_m2") rafraichirCarte();
  majDetail();
}

// ---------- Interface ----------
function initInterface() {
  const cs = codes().sort((a, b) => a - b);

  const selInd = document.getElementById("select-indicateur");
  for (const [cle, cfg] of Object.entries(INDICATEURS_CARTE)) selInd.add(new Option(`${cfg.icon}  ${cfg.label}`, cle));
  selInd.value = indicateurCourant;
  selInd.addEventListener("change", () => { indicateurCourant = selInd.value; rafraichirCarte(); });

  const selArr = document.getElementById("select-arr");
  for (const c of cs) selArr.add(new Option(`${c} — ${nomArr(c)}`, c));
  selArr.addEventListener("change", () => setArrActif(Number(selArr.value), true));

  const slider = document.getElementById("annee-slider");
  slider.min = 0; slider.max = annees.length - 1; slider.value = annees.length - 1;
  slider.addEventListener("input", () => majAnnee(Number(slider.value)));
  document.getElementById("annee-prev").addEventListener("click", () => { if (slider.value > 0) majAnnee(Number(slider.value) - 1); });
  document.getElementById("annee-next").addEventListener("click", () => { if (slider.value < annees.length - 1) majAnnee(Number(slider.value) + 1); });
  document.getElementById("annee-label").textContent = anneeActive;

  document.getElementById("toggle-fontaines").addEventListener("change", (e) => toggleFontaines(e.target.checked));
  document.getElementById("toggle-marches").addEventListener("change", (e) => toggleMarches(e.target.checked));
  document.getElementById("toggle-transport").addEventListener("change", (e) => toggleTransport(e.target.checked));

  const selA = document.getElementById("select-a"), selB = document.getElementById("select-b");
  for (const c of cs) { selA.add(new Option(`${c} — ${nomArr(c)}`, c)); selB.add(new Option(`${c} — ${nomArr(c)}`, c)); }
  selA.value = 1; selB.value = 16;
  selA.addEventListener("change", majComparaison);
  selB.addEventListener("change", majComparaison);

  document.getElementById("tab-carte").addEventListener("click", () => switchVue("carte"));
  document.getElementById("tab-comparaison").addEventListener("click", () => switchVue("comparaison"));

  initCarte();
  paliers = calculerPaliers();
  rafraichirCarte();
  setArrActif(1, false);
}

function switchVue(vue) {
  const carte = vue === "carte";
  document.getElementById("vue-carte").classList.toggle("hidden", !carte);
  document.getElementById("vue-comparaison").classList.toggle("hidden", carte);
  document.getElementById("tab-carte").classList.toggle("active", carte);
  document.getElementById("tab-comparaison").classList.toggle("active", !carte);
  if (carte && map) setTimeout(() => map.resize(), 60); else majComparaison();
}

// ---------- Comparaison ----------
function majComparaison() {
  const a = Number(document.getElementById("select-a").value), b = Number(document.getElementById("select-b").value);
  const indics = [
    ["Prix médian €/m²", (c) => ligneAnnee(DATA.prix_m2[c], anneeMax(c))?.prix_m2_median],
    ["Évolution %", (c) => ligneAnnee(DATA.prix_m2[c], anneeMax(c))?.evolution_pct],
    ["Part logements sociaux %", (c) => premier(DATA.logements_sociaux_part[c], "part_logements_sociaux_pct")],
    ["Accessibilité m²/an", (c) => premier(DATA.accessibilite[c], "m2_par_revenu_annuel")],
    ["Fraîcheur (total)", (c) => premier(DATA.fraicheur[c], "nb_total_fraicheur")],
    ["Arrêts transport", (c) => premier(DATA.transport[c], "nb_total_arrets")],
    ["Marchés", (c) => premier(DATA.marches[c], "nb_marches")],
    ["Tension (rendement %)", (c) => premier(DATA.tension[c], "rendement_locatif_pct")],
  ];
  let html = `<table><thead><tr><th>Indicateur</th><th class="col-a">${nomArr(a)}</th><th class="col-b">${nomArr(b)}</th></tr></thead><tbody>`;
  for (const [label, fn] of indics) html += `<tr><td>${label}</td><td>${fmt1(fn(a))}</td><td>${fmt1(fn(b))}</td></tr>`;
  html += "</tbody></table>";
  document.getElementById("tableau-comparaison").innerHTML = html;

  const ans = [...new Set((DATA.prix_m2[a] || []).concat(DATA.prix_m2[b] || []).map((l) => l.annee))].sort();
  const serie = (c) => ans.map((an) => ligneAnnee(DATA.prix_m2[c], an)?.prix_m2_median ?? null);
  if (chartPrix) chartPrix.destroy();
  chartPrix = new Chart(document.getElementById("chart-prix"), { type: "line",
    data: { labels: ans, datasets: [
      { label: nomArr(a), data: serie(a), borderColor: "#0aa1a8", backgroundColor: "#0aa1a8", tension: .25 },
      { label: nomArr(b), data: serie(b), borderColor: "#e3611a", backgroundColor: "#e3611a", tension: .25 }] }, options: { responsive: true } });

  const labels = ["Fraîcheur", "Transport", "Marchés", "Part log. soc. %"];
  const vals = (c) => [premier(DATA.fraicheur[c], "nb_total_fraicheur") || 0, premier(DATA.transport[c], "nb_total_arrets") || 0, premier(DATA.marches[c], "nb_marches") || 0, premier(DATA.logements_sociaux_part[c], "part_logements_sociaux_pct") || 0];
  if (chartComposites) chartComposites.destroy();
  chartComposites = new Chart(document.getElementById("chart-composites"), { type: "bar",
    data: { labels, datasets: [{ label: nomArr(a), data: vals(a), backgroundColor: "#0aa1a8" }, { label: nomArr(b), data: vals(b), backgroundColor: "#e3611a" }] }, options: { responsive: true } });
}

chargerDonnees();
