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
        url: "https://services1.arcgis.com/KsnB2VOAvO5LjdB4/arcgis/rest/services/Toronto_Municipality_Overview_Map_Demo1/FeatureServer/25",
        title: "Property parcels",
        outFields: ["PARCELID", "FEATURE_TYPE", "ADDRESS", "hazard_score", "infrastructure_score", "max_depth_aug_2024", "max_depth_sep_1948"],
        minScale: 20000
    });
    map.add(propertyLayer);

    // ---- Address labels: only at 1:1500 or closer, "None None" suppressed ----
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
        minScale: 1500,
        maxScale: 0
    }];
    propertyLayer.labelsVisible = true;

    // ---- Flood band renderers. Identical colours; only the shallow band value differs:
    //      August floor = 0.15 m, September floor = 0.1 m. ----
    const floodAugRenderer = {
        type: "unique-value",
        field: "max_depth",
        uniqueValueInfos: [
            { value: 1.5,  label: "1.5 m",  symbol: { type: "simple-fill", color: [132, 0, 168],  outline: { width: 0 } } },
            { value: 1.2,  label: "1.2 m",  symbol: { type: "simple-fill", color: [0, 38, 115],   outline: { width: 0 } } },
            { value: 0.8,  label: "0.8 m",  symbol: { type: "simple-fill", color: [0, 77, 168],   outline: { width: 0 } } },
            { value: 0.4,  label: "0.4 m",  symbol: { type: "simple-fill", color: [0, 112, 255],  outline: { width: 0 } } },
            { value: 0.3,  label: "0.3 m",  symbol: { type: "simple-fill", color: [115, 178, 255], outline: { width: 0 } } },
            { value: 0.15, label: "0.15 m", symbol: { type: "simple-fill", color: [190, 210, 255], outline: { width: 0 } } }
        ]
    };

    const floodSepRenderer = {
        type: "unique-value",
        field: "max_depth",
        uniqueValueInfos: [
            { value: 1.5,  label: "1.5 m",  symbol: { type: "simple-fill", color: [132, 0, 168],  outline: { width: 0 } } },
            { value: 1.2,  label: "1.2 m",  symbol: { type: "simple-fill", color: [0, 38, 115],   outline: { width: 0 } } },
            { value: 0.8,  label: "0.8 m",  symbol: { type: "simple-fill", color: [0, 77, 168],   outline: { width: 0 } } },
            { value: 0.4,  label: "0.4 m",  symbol: { type: "simple-fill", color: [0, 112, 255],  outline: { width: 0 } } },
            { value: 0.3,  label: "0.3 m",  symbol: { type: "simple-fill", color: [115, 178, 255], outline: { width: 0 } } },
            { value: 0.1,  label: "0.1 m",  symbol: { type: "simple-fill", color: [190, 210, 255], outline: { width: 0 } } }
        ]
    };

    const floodAug = new FeatureLayer({
        url: "https://services1.arcgis.com/KsnB2VOAvO5LjdB4/arcgis/rest/services/toronto_aug_1_2024_storm_merged_single/FeatureServer/23",
        title: "August 1, 2024 storm",
        outFields: ["max_depth"],
        renderer: floodAugRenderer,
        opacity: 0.5,
        minScale: 75000,
        visible: false
    });
    map.add(floodAug);

    const floodSep = new FeatureLayer({
        url: "https://services1.arcgis.com/KsnB2VOAvO5LjdB4/arcgis/rest/services/sept_1948_storm_complete/FeatureServer/86",
        title: "September 18, 1948 storm",
        outFields: ["max_depth"],
        renderer: floodSepRenderer,
        opacity: 0.5,
        minScale: 75000,
        visible: false
    });
    map.add(floodSep);

    const view = new MapView({
        container: "viewDiv",
        map: map,
        center: [-79.38, 43.65],
        zoom: 11,
        constraints: { geometry: torontoExtent, minZoom: 10, rotationEnabled: false }
    });

    view.ui.add(new Search({ view: view }), "top-right");
    view.ui.add(new BasemapToggle({ view: view, nextBasemap: "hybrid" }), "bottom-left");

    // Legend: whichever flood layer is visible shows; parcels always.
    view.ui.add(new Legend({
        view: view,
        layerInfos: [
            { layer: floodAug },
            { layer: floodSep },
            { layer: propertyLayer }
        ]
    }), "bottom-right");

    // ---- Property symbology ----
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
            floodAug.visible = false;
            floodSep.visible = false;
        } else if (scenario === "a") {
            propertyLayer.renderer = rendererA;
            propertyLayer.popupTemplate = popupA;
            floodAug.visible = true;
            floodSep.visible = false;
        } else {  // "b" - September
            propertyLayer.renderer = rendererB;
            propertyLayer.popupTemplate = popupB;
            floodAug.visible = false;
            floodSep.visible = true;
        }
    }

    scenarioSelect.addEventListener("change", (e) => applyScenario(e.target.value));
    applyScenario(scenarioSelect.value);

});