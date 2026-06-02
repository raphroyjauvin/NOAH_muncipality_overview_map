require([
    "esri/Map",
    "esri/views/MapView",
    "esri/geometry/Extent",
    "esri/geometry/support/webMercatorUtils",
    "esri/widgets/BasemapToggle",
    "esri/widgets/Search",
    "esri/widgets/Legend",
    "esri/layers/FeatureLayer"
], function (Map, MapView, Extent, webMercatorUtils, BasemapToggle, Search, Legend, FeatureLayer) {

    const torontoExtent = webMercatorUtils.geographicToWebMercator(new Extent({
        xmin: -79.65, ymin: 43.55, xmax: -79.10, ymax: 43.88,
        spatialReference: { wkid: 4326 }
    }));

    const map = new Map({ basemap: "gray-vector" });

    const propertyLayer = new FeatureLayer({
        url: "https://services1.arcgis.com/KsnB2VOAvO5LjdB4/arcgis/rest/services/Toronto_Municipality_Overview_Map_Demo1/FeatureServer/1",
        title: "Property parcels",
        outFields: ["PARCELID", "FEATURE_TYPE", "ADDRESS", "hazard_score", "infrastructure_score", "max_depth_aug_2024", "max_depth_sep_1948"],
        minScale: 75000
    });
    map.add(propertyLayer);

    // ---- Address labels: only at 1:1500 or more zoomed in ----
    propertyLayer.labelingInfo = [{
        labelExpressionInfo: {
            expression: `
                var addr = Trim($feature.ADDRESS);
                if (IsEmpty(addr) || addr == 'None None') { return ''; }
                return addr;
            `
        },
        symbol: {
            type: "text",
            color: [50, 50, 50],
            haloColor: [255, 255, 255],
            haloSize: 1,
            font: { size: 9, family: "sans-serif" }
        },
        labelPlacement: "always-horizontal",
        minScale: 1500,   // labels appear only at 1:1500 and closer
        maxScale: 0
    }];
    propertyLayer.labelsVisible = true;

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-79.38, 43.65],
        zoom: 11,
        constraints: { geometry: torontoExtent, minZoom: 10, rotationEnabled: false }
    });

    view.ui.add(new Search({ view: view }), "top-right");
    view.ui.add(new BasemapToggle({ view: view, nextBasemap: "hybrid" }), "bottom-left");

    // Legend: only the property parcels layer
    view.ui.add(new Legend({
        view: view,
        layerInfos: [{ layer: propertyLayer }]
    }), "bottom-right");

    // ---- Symbology ----
    const grayOutline      = { color: [179, 179, 179], width: 0.75 };
    const notFloodedSymbol = { type: "simple-fill", style: "none", outline: grayOutline };
    const floodedSymbol    = { type: "simple-fill", color: [231, 76, 60, 0.25], outline: grayOutline };

    const neutralRenderer = { type: "simple", symbol: notFloodedSymbol };

    function floodRenderer(depthField) {
        return {
            type: "class-breaks",
            field: depthField,
            defaultSymbol: notFloodedSymbol,
            defaultLabel: "Not flooded (< 0.15 m)",
            classBreakInfos: [
                { minValue: 0.15, maxValue: 100000, symbol: floodedSymbol, label: "Flooded (\u2265 0.15 m)" }
            ]
        };
    }
    const rendererA = floodRenderer("max_depth_aug_2024");
    const rendererB = floodRenderer("max_depth_sep_1948");

    // ---- Popups ----
    const scoreFields = [
        { fieldName: "hazard_score",         label: "Property Hazard Score" },
        { fieldName: "infrastructure_score", label: "Property Infrastructure Score" }
    ];

    function makePopup(depthField) {
        const fieldInfos = scoreFields.slice();
        if (depthField) {
            fieldInfos.push({ fieldName: depthField, label: "Max Flood Depth (m)", format: { places: 2 } });
        }
        return { title: "{ADDRESS}", content: [{ type: "fields", fieldInfos: fieldInfos }] };
    }
    const popupNone = makePopup(null);
    const popupA    = makePopup("max_depth_aug_2024");
    const popupB    = makePopup("max_depth_sep_1948");

    // ---- Scenario selector ----
    const scenarioPanel  = document.getElementById("scenarioPanel");
    const scenarioSelect = document.getElementById("scenarioSelect");
    const scenarioStatus = document.getElementById("scenarioStatus");
    view.ui.add(scenarioPanel, { position: "top-left", index: 0 });

    const labels = { a: "August 1, 2024", b: "September 18, 1948" };

    function applyScenario(scenario) {
        scenarioStatus.textContent =
            (scenario === "none") ? "No scenario selected" : "Showing: " + labels[scenario];

        if (scenario === "none") {
            propertyLayer.renderer = neutralRenderer;
            propertyLayer.popupTemplate = popupNone;
        } else if (scenario === "a") {
            propertyLayer.renderer = rendererA;
            propertyLayer.popupTemplate = popupA;
        } else {
            propertyLayer.renderer = rendererB;
            propertyLayer.popupTemplate = popupB;
        }
    }

    scenarioSelect.addEventListener("change", (e) => applyScenario(e.target.value));
    applyScenario(scenarioSelect.value);

});