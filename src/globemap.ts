/*
 *  Power BI Visualizations
 *
 *  Copyright (c) Microsoft Corporation
 *  All rights reserved.
 *  MIT License
 *
 *  Permission is hereby granted, free of charge, to any person obtaining a copy
 *  of this software and associated documentation files (the ""Software""), to deal
 *  in the Software without restriction, including without limitation the rights
 *  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 *  copies of the Software, and to permit persons to whom the Software is
 *  furnished to do so, subject to the following conditions:
 *
 *  The above copyright notice and this permission notice shall be included in
 *  all copies or substantial portions of the Software.
 *
 *  THE SOFTWARE IS PROVIDED *AS IS*, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 *  IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 *  FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 *  AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 *  LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 *  OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 *  THE SOFTWARE.
 */
import "./../style/globemap.less";

import powerbi from "powerbi-visuals-api";
import * as _ from "lodash";
import "@babel/polyfill";

import * as THREE from "three";
import "./lib/OrbitControls";
import "../bower_components/webgl-heatmap/webgl-heatmap";
import * as $ from "jquery";

import IPromise = powerbi.IPromise;
import DataView = powerbi.DataView;
import PrimitiveValue = powerbi.PrimitiveValue;
import DataViewValueColumn = powerbi.DataViewValueColumn;
import DataViewCategoryColumn = powerbi.DataViewCategoryColumn;
import DataViewValueColumns = powerbi.DataViewValueColumns;
import DataViewValueColumnGroup = powerbi.DataViewValueColumnGroup;
import VisualObjectInstance = powerbi.VisualObjectInstance;
import DataViewMetadataColumn = powerbi.DataViewMetadataColumn;
import VisualObjectInstanceEnumeration = powerbi.VisualObjectInstanceEnumeration;
import DataViewObjectPropertyIdentifier = powerbi.DataViewObjectPropertyIdentifier;
import EnumerateVisualObjectInstancesOptions = powerbi.EnumerateVisualObjectInstancesOptions;
import VisualObjectInstanceEnumerationObject = powerbi.VisualObjectInstanceEnumerationObject;

import ISelectionId = powerbi.visuals.ISelectionId;

import IVisual = powerbi.extensibility.IVisual;
import ILocalVisualStorageService = powerbi.extensibility.ILocalVisualStorageService;
import VisualTooltipDataItem = powerbi.extensibility.VisualTooltipDataItem;
import IColorPalette = powerbi.extensibility.IColorPalette;
import TooltipHideOptions = powerbi.extensibility.TooltipHideOptions;
import TooltipShowOptions = powerbi.extensibility.TooltipShowOptions;
import ITooltipService = powerbi.extensibility.ITooltipService;
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisualHost = powerbi.extensibility.visual.IVisualHost;

import { GlobeMapSettings } from "./settings";
import { VisualLayout } from "./visualLayout";
import { GlobeMapCategoricalColumns, GlobeMapColumns } from "./columns";
import {
    GlobeMapData,
    GlobeMapDataPoint,
    GlobeMapSeriesDataPoint,
    ITileGapObject, TileMap,
    BingResourceMetadata,
    BingMetadata,
    IGlobeMapValueTypeDescriptor,
    IGlobeMapObject3DWithToolTipData,
    ICanvasCoordinate
} from "./dataInterfaces";

class GlobeMapHeatMapClass {
    constructor(properties: {}) { }
    public display() { }
    public blur() { }
    public update() { }
    public clear() { }
    public addPoint(x: number, y: number, heatPointSize: number, heatIntensity: number) { }
    canvas: HTMLVideoElement;
}
let WebGLHeatmap = <typeof GlobeMapHeatMapClass>window["createWebGLHeatmap"];

// powerbi.extensibility.geocoder
import { ILocation, createGeocoder, Settings } from "./geocoder/geocoder";
import { IGeocoder, IGeocodeCoordinate } from "./geocoder/geocoderInterfaces";

// powerbi.extensibility.utils.dataview
import { converterHelper as ch } from "powerbi-visuals-utils-dataviewutils";
import converterHelper = ch.converterHelper;

// powerbi.extensibility.utils.color
import { ColorHelper } from "powerbi-visuals-utils-colorutils";

// powerbi.extensibility.utils.formatting
import { valueFormatter as vf } from "powerbi-visuals-utils-formattingutils";
import IValueFormatter = vf.IValueFormatter;
import valueFormatter = vf.valueFormatter;

interface ExtendedPromise<T> extends IPromise<T> {
    always(value: {}): void;
}

export class MercartorSphere extends THREE.Geometry {
    radius: number;
    widthSegments: number;
    heightSegments: number;
    t: number;
    vertices: THREE.Vector3[];
    prototype: {};
    constructor(radius: number, widthSegments: number, heightSegments: number) {
        super();
        this.radius = radius;
        this.widthSegments = widthSegments;
        this.heightSegments = heightSegments;

        this.t = 0;

        let x: number;
        let y: number;
        const vertices = [];
        const uvs = [];

        function interplolate(a, b, t) {
            return (1 - t) * a + t * b;
        }

        // interpolates between sphere and plane
        function interpolateVertex(u: number, v: number, t: number) {
            const maxLng: number = Math.PI * 2;
            const maxLat: number = Math.PI;

            const sphereX: number = - this.radius * Math.cos(u * maxLng) * Math.sin(v * maxLat);
            const sphereY: number = - this.radius * Math.cos(v * maxLat);
            const sphereZ: number = this.radius * Math.sin(u * maxLng) * Math.sin(v * maxLat);

            const planeX: number = u * this.radius * 2 - this.radius;
            const planeY: number = v * this.radius * 2 - this.radius;
            const planeZ: number = 0;

            const x1: number = interplolate(sphereX, planeX, t);
            const y1: number = interplolate(sphereY, planeY, t);
            const z: number = interplolate(sphereZ, planeZ, t);

            return new THREE.Vector3(x1, y1, z);
        }

        // http://mathworld.wolfram.com/MercatorProjection.html
        // Mercator projection goes form +85.05 to -85.05 degrees
        function interpolateUV(u: number, v: number, t: number) {
            const lat: number = (v - 0.5) * 89.99 * 2 / 180 * Math.PI; // turn from 0-1 into lat in radians
            const sin: number = Math.sin(lat);
            const normalizedV: number = 0.5 + 0.25 * Math.log((1 + sin) / (1 - sin)) / Math.PI;
            return new THREE.Vector2(u, normalizedV); // interplolate(normalizedV1, v, t))
        }

        for (y = 0; y <= heightSegments; y++) {

            const verticesRow: number[] = [];
            const uvsRow: number[] = [];

            for (x = 0; x <= widthSegments; x++) {

                const u: number = x / widthSegments;
                const v: number = y / heightSegments;

                this.vertices.push(interpolateVertex.call(this, u, v, this.t));
                uvsRow.push(interpolateUV.call(this, u, v, this.t));
                verticesRow.push(this.vertices.length - 1);
            }

            vertices.push(verticesRow);
            uvs.push(uvsRow);

        }

        for (y = 0; y < this.heightSegments; y++) {

            for (x = 0; x < this.widthSegments; x++) {

                const v1: number = vertices[y][x + 1];
                const v2: number = vertices[y][x];
                const v3: number = vertices[y + 1][x];
                const v4: number = vertices[y + 1][x + 1];

                const n1: THREE.Vector3 = this.vertices[v1].clone().normalize();
                const n2: THREE.Vector3 = this.vertices[v2].clone().normalize();
                const n3: THREE.Vector3 = this.vertices[v3].clone().normalize();
                const n4: THREE.Vector3 = this.vertices[v4].clone().normalize();

                const uv1: THREE.Vector2 = uvs[y][x + 1];
                const uv2: THREE.Vector2 = uvs[y][x];
                const uv3: THREE.Vector2 = uvs[y + 1][x];
                const uv4: THREE.Vector2 = uvs[y + 1][x + 1];

                this.faces.push(new THREE.Face3(v1, v2, v3, [n1, n2, n3]));
                this.faces.push(new THREE.Face3(v1, v3, v4, [n1, n3, n4]));

                this.faceVertexUvs[0].push([uv1.clone(), uv2.clone(), uv3.clone()]);
                this.faceVertexUvs[0].push([uv1.clone(), uv3.clone(), uv4.clone()]);
            }
        }

        this.computeFaceNormals();
        this.computeVertexNormals();
        this.computeBoundingSphere();
    }
}

export class GlobeMap implements IVisual {
    private localStorageService: ILocalVisualStorageService;
    public static MercartorSphere: MercartorSphere;
    private GlobeSettings = {
        autoRotate: false,
        earthRadius: 30,
        cameraRadius: 100,
        earthSegments: 100,
        heatmapSize: 1024,
        heatIntensity: 10,
        minHeatIntensity: 2,
        maxHeatIntensity: 10,
        heatPointSize: 7,
        minHeatPointSize: 2,
        maxHeatPointSize: 7,
        heatmapScaleOnZoom: 0.95,
        barWidth: 0.3,
        minBarWidth: 0.01,
        maxBarWidth: 0.3,
        barWidthScaleOnZoom: 0.9,
        barHeight: 5,
        minBarHeight: 0.75,
        maxBarHeight: 5,
        barHeightScaleOnZoom: 0.9,
        rotateSpeed: 0.5,
        zoomSpeed: 0.8,
        cameraAnimDuration: 1000, // ms
        clickInterval: 200 // ms
    };
    private static ChangeDataType: number = 2;
    private static ChangeAllType: number = 62;
    private static DataPointFillProperty: DataViewObjectPropertyIdentifier = {
        objectName: "dataPoint",
        propertyName: "fill"
    };
    private static CountTilesPerSegment: number = 4;
    private layout: VisualLayout;
    private root: JQuery;
    private rendererContainer: JQuery;
    private rendererCanvas: HTMLElement;
    private camera: THREE.PerspectiveCamera;
    private renderer: THREE.WebGLRenderer;
    private scene: THREE.Scene;
    private orbitControls: THREE.OrbitControls;
    private earth: THREE.Mesh | { material };
    private data: GlobeMapData;
    private get settings(): GlobeMapSettings {
        return this.data && this.data.settings;
    }
    private heatmap: GlobeMapHeatMapClass;
    private heatTexture: THREE.Texture;
    private mapTextures: THREE.Texture[];
    public barsGroup: THREE.Object3D;
    private readyToRender: boolean;
    private deferredRenderTimerId: number;
    private globeMapLocationCache: { [i: string]: ILocation };
    private locationsToLoad: number = 0;
    private locationsLoaded: number = 0;
    private initialLocationsLength: number = 0;
    private renderLoopEnabled = true;
    private needsRender = false;
    private mousePosNormalized: THREE.Vector2;
    private mousePos: THREE.Vector2;
    private rayCaster: THREE.Raycaster;
    private selectedBar: THREE.Object3D;
    private hoveredBar: THREE.Object3D;
    private averageBarVector: THREE.Vector3;
    private controlContainer: HTMLElement;
    public colors: IColorPalette;
    private animationFrameId: number;
    private cameraAnimationFrameId: number;
    public visualHost: IVisualHost;

    private isFirstLoad: boolean = true;

    private tooltipService: ITooltipService;
    private static datapointShiftPoint: number = 0.01;
    public static converter(dataView: DataView, colors: IColorPalette, visualHost: IVisualHost): GlobeMapData {
        const categorical: GlobeMapColumns<GlobeMapCategoricalColumns> = GlobeMapColumns.getCategoricalColumns(dataView);
        if (!categorical
            || !categorical.Location
            || _.isEmpty(categorical.Location.values) && !(categorical.X && categorical.Y)) {
            return null;
        }

        const settings: GlobeMapSettings = GlobeMap.parseSettings(dataView);
        const groupedColumns: GlobeMapColumns<DataViewValueColumn>[] = GlobeMapColumns.getGroupedValueColumns(dataView);
        const dataPoints: GlobeMapDataPoint[] = [];
        let seriesDataPoints: GlobeMapSeriesDataPoint[] = [];
        let locations: PrimitiveValue[] = [];
        const colorHelper: ColorHelper = new ColorHelper(colors, GlobeMap.DataPointFillProperty);
        let locationType: string;
        let heights: number[];
        let heightsBySeries: number[] | number[][];
        let toolTipDataBySeries: {}[];
        let heats: number[];

        if (categorical.Location
            && categorical.Location.values
            && categorical.Location.source
        ) {
            locations = categorical.Location.values;

            const sourceType: IGlobeMapValueTypeDescriptor = <IGlobeMapValueTypeDescriptor>categorical.Location.source.type;

            locationType = sourceType.category
                ? `${sourceType.category}`.toLowerCase()
                : "";
        } else {
            locations = [];
            if (categorical.X && categorical.Y && categorical.X.values && categorical.Y.values) {
                locations = new Array(categorical.X.values.length);
            }
        }
        if (!_.isEmpty(categorical.Height)) {
            if (groupedColumns.length > 1) {
                heights = [];
                heightsBySeries = [];
                toolTipDataBySeries = [];
                seriesDataPoints = [];
                // creating a matrix for drawing values by series later.
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Height.values;
                    let dataPointsParams = {
                        dataView: dataView,
                        source: groupedColumns[i].Height.source,
                        seriesIndex: i,
                        metaData: null,
                        colorHelper: colorHelper,
                        colors: colors,
                        visualHost: visualHost,
                        catIndex: null
                    };
                    seriesDataPoints[i] = GlobeMap.createDataPointForEnumeration(dataPointsParams);
                    for (let j: number = 0; j < values.length; j++) {
                        if (!heights[j]) {
                            heights[j] = 0;
                        }
                        heights[j] += values[j] ? values[j] : 0;
                        if (!heightsBySeries[j]) {
                            heightsBySeries[j] = <number[]>[];
                        }
                        heightsBySeries[j][i] = values[j];
                        if (!toolTipDataBySeries[j]) {
                            toolTipDataBySeries[j] = [];
                        }
                        toolTipDataBySeries[j][i] = {
                            displayName: categorical.Series && categorical.Series.source && categorical.Series.source.displayName,
                            value: dataView.categorical.values.grouped()[i].name,
                            dataPointValue: values[j]
                        };
                    }
                }
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Height.values;
                    for (let j: number = 0; j < values.length; j++) {
                        // calculating relative size of series
                        heightsBySeries[j][i] = <number>values[j] / <number>heights[j];
                    }
                }
            } else {
                heights = <number[]>categorical.Height[0].values;
                heightsBySeries = [];
                heights.forEach((element, index) => {
                    let displayName: PrimitiveValue;
                    if (categorical.X && categorical.Y && categorical.X.values && categorical.Y.values) {
                        displayName = groupedColumns[0].Height.source.displayName + index;
                    } else if (categorical.Location) {
                        displayName = categorical.Location.values[index];
                    }

                    let dataPointsParams = {
                        dataView: dataView,
                        source: { ...groupedColumns[0].Height.source, displayName: displayName },
                        seriesIndex: 0,
                        metaData: dataView.metadata,
                        colorHelper: colorHelper,
                        colors: colors,
                        visualHost: visualHost,
                        catIndex: index
                    };
                    seriesDataPoints[index] = GlobeMap.createDataPointForEnumeration(dataPointsParams);
                });
            }
        } else {
            heightsBySeries = [];
            heights = [];
            if (categorical.Location && categorical.Location.values || categorical.X && categorical.Y && categorical.X.values && categorical.Y.values) {
                let heightsLenght: number = 0;
                if (categorical.Location && categorical.Location.values) {
                    heightsLenght = categorical.Location.values.length;
                } else if (categorical.X && categorical.X.values) {
                    heightsLenght = categorical.X.values.length;
                }

                for (let i = 0; i < heightsLenght; i++) {
                    heights.push(1);
                }
                const color: string = colorHelper.getColorForMeasure(dataView.metadata.objects, "");
                seriesDataPoints[0] = {
                    label: "label",
                    identity: "identity",
                    category: "category",
                    color: color,
                    selected: null
                };
            }
        }
        if (!_.isEmpty(categorical.Heat)) {
            if (groupedColumns.length > 1) {
                heats = [];
                for (let i: number = 0; i < groupedColumns.length; i++) {
                    const values: number[] = <number[]>groupedColumns[i].Heat.values;
                    for (let j = 0; j < values.length; j++) {
                        if (!heats[j]) {
                            heats[j] = 0;
                        }
                        heats[j] += values[j] ? values[j] : 0;
                    }
                }
            } else {
                heats = <number[]>categorical.Heat[0].values;
            }

        } else {
            heats = [];
        }
        const maxHeight: number = Math.max.apply(null, heights) || 1;
        const maxHeat: number = Math.max.apply(null, heats) || 1;
        const heatFormatter: IValueFormatter = valueFormatter.create({
            format: !_.isEmpty(categorical.Heat) && categorical.Heat[0].source.format,
            value: heats[0],
            value2: heats[1]
        });
        const heightFormatter = valueFormatter.create({
            format: !_.isEmpty(categorical.Height) && categorical.Height[0].source.format,
            value: heights[0],
            value2: heights[1]
        });
        const len: number = locations.length;
        for (let i: number = 0; i < len; ++i) {
            if (typeof (locations[i]) === "string" || (categorical.X && categorical.Y && categorical.X.values && categorical.Y.values)) {
                const height: number = <number>heights[i] / maxHeight;
                const heat: number = <number>heats[i] / maxHeat;
                let place: string;
                let placeKey: string;
                let toolTipDataLocationName: string;
                let toolTipDataLongName: string;
                let toolTipDataLatName: string;
                let location: ILocation;
                let locationValue: string;
                if (typeof (locations[i]) === "string") {
                    place = `${locations[i]}`.toLowerCase();
                    placeKey = `${place} / ${locationType}`;
                    location = (!_.isEmpty(categorical.X) && !_.isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X[0].values[i] || 0, latitude: <number>categorical.Y[0].values[i] || 0 }
                        : undefined;
                    toolTipDataLocationName = categorical.Location && categorical.Location.source.displayName;
                    locationValue = `${locations[i]}`;
                } else {
                    place = `${categorical.X.values[i]} ${categorical.Y.values[i]}`;
                    placeKey = categorical.X.values[i] + " " + categorical.Y.values[i];
                    location = (!_.isEmpty(categorical.X) && !_.isEmpty(categorical.Y))
                        ? { longitude: <number>categorical.X.values[i] || 0, latitude: <number>categorical.Y.values[i] || 0 }
                        : undefined;
                    toolTipDataLongName = categorical.X && categorical.X.source && categorical.X.source.displayName;
                    toolTipDataLatName = categorical.Y && categorical.Y.source && categorical.Y.source.displayName;
                    locationValue = "";
                }

                const longitudeValue: string = GlobeMap.getCategoricalValueByIndex(categorical.X, i);
                const latitudeValue: string = GlobeMap.getCategoricalValueByIndex(categorical.Y, i);

                let renderDatum: GlobeMapDataPoint = {
                    location: location,
                    placeKey: placeKey,
                    place: place,
                    locationType: locationType,
                    height: height ? height || GlobeMap.datapointShiftPoint : undefined,
                    heightBySeries: <number[]>heightsBySeries[i],
                    seriesToolTipData: toolTipDataBySeries ? toolTipDataBySeries[i] : undefined,
                    heat: heat || 0,
                    toolTipData: {
                        location: { displayName: !_.isEmpty(toolTipDataLocationName) && toolTipDataLocationName, value: locationValue },
                        longitude: { displayName: !_.isEmpty(toolTipDataLongName) && toolTipDataLongName, value: longitudeValue },
                        latitude: { displayName: !_.isEmpty(toolTipDataLatName) && toolTipDataLatName, value: latitudeValue },
                        height: { displayName: !_.isEmpty(categorical.Height) && categorical.Height[0].source.displayName, value: heightFormatter.format(heights[i]) },
                        heat: { displayName: !_.isEmpty(categorical.Heat) && categorical.Heat[0].source.displayName, value: heatFormatter.format(heats[i]) }
                    }
                };
                dataPoints.push(renderDatum);
            }
        }
        return {
            dataView: dataView,
            dataPoints: dataPoints,
            seriesDataPoints: seriesDataPoints,
            settings: settings
        };
    }

    private static parseSettings(dataView: DataView): GlobeMapSettings {
        return GlobeMapSettings.parse(dataView) as GlobeMapSettings;
    }

    private static createDataPointForEnumeration(dataPointsParams: { dataView, seriesIndex, source, visualHost, catIndex, metaData, colors, colorHelper }): GlobeMapSeriesDataPoint {
        const columns: DataViewValueColumnGroup = dataPointsParams.dataView.categorical.values.grouped()[dataPointsParams.seriesIndex];
        const values: DataViewValueColumns = <DataViewValueColumns>columns.values;
        let sourceForFormat: DataViewMetadataColumn = dataPointsParams.source;
        let nameForFormat: PrimitiveValue = dataPointsParams.source.displayName;

        if (dataPointsParams.source.groupName !== undefined) {
            sourceForFormat = values.source;
            nameForFormat = dataPointsParams.source.groupName;
        }

        const label: string = valueFormatter.format(nameForFormat, valueFormatter.getFormatString(sourceForFormat, null));

        const categoryColumn: DataViewCategoryColumn = dataPointsParams.dataView
            && dataPointsParams.dataView.categorical
            && dataPointsParams.dataView.categorical.categories
            && dataPointsParams.dataView.categorical.categories[0];

        const identity: ISelectionId =
            dataPointsParams.visualHost.createSelectionIdBuilder()
                .withCategory(categoryColumn, dataPointsParams.catIndex)
                .createSelectionId();

        const category: string = `${converterHelper.getSeriesName(dataPointsParams.source)}`;
        const objects: {} = categoryColumn && categoryColumn.objects;
        const color: string =
            objects && objects[dataPointsParams.catIndex] && objects[dataPointsParams.catIndex].dataPoint ?
                objects[dataPointsParams.catIndex].dataPoint.fill.solid.color : dataPointsParams.metaData && dataPointsParams.metaData.objects
                    ? dataPointsParams.colorHelper.getColorForMeasure(dataPointsParams.metaData.objects, "")
                    : dataPointsParams.colors.getColor(dataPointsParams.seriesIndex).value;

        return {
            label: label,
            identity: identity,
            category: category,
            color: color,
            selected: null
        };
    }

    private addAnInstanceToEnumeration(
        instanceEnumeration: VisualObjectInstanceEnumeration,
        instance: VisualObjectInstance): void {

        if ((instanceEnumeration as VisualObjectInstanceEnumerationObject).instances) {
            (instanceEnumeration as VisualObjectInstanceEnumerationObject)
                .instances
                .push(instance);
        } else {
            (instanceEnumeration as VisualObjectInstance[]).push(instance);
        }
    }

    public enumerateObjectInstances(options: EnumerateVisualObjectInstancesOptions): VisualObjectInstance[] | VisualObjectInstanceEnumerationObject {
        let instances: VisualObjectInstanceEnumeration = GlobeMapSettings.enumerateObjectInstances(this.settings || GlobeMapSettings.getDefault(), options);
        switch (options.objectName) {
            case "dataPoint": if (this.data && this.data.seriesDataPoints) {
                for (let i: number = 0; i < this.data.seriesDataPoints.length; i++) {
                    let dataPoint: GlobeMapSeriesDataPoint = this.data.seriesDataPoints[i];
                    this.addAnInstanceToEnumeration(instances, {
                        objectName: "dataPoint",
                        displayName: dataPoint.label,
                        selector: ColorHelper.normalizeSelector((dataPoint.identity as ISelectionId).getSelector()),
                        properties: {
                            fill: { solid: { color: dataPoint.color } }
                        }
                    });
                }
            }
                break;
        }
        return instances;
    }

    constructor(options: VisualConstructorOptions) {
        this.currentLanguage = options.host.locale;
        this.localStorageService = options.host.storageService;
        this.root = $("<div>").appendTo(options.element)
            .attr("drag-resize-disabled", "true")
            .css({
                "position": "absolute"
            });

        this.visualHost = options.host;
        this.tooltipService = this.visualHost.tooltipService;

        this.layout = new VisualLayout();
        this.readyToRender = false;

        if (!this.globeMapLocationCache) {
            this.globeMapLocationCache = {};
        }

        this.colors = options.host.colorPalette;

        // if (window["THREE"]) {
        this.setup();
        // }
    }

    private setup(): void {
        this.initScene();
        this.initMercartorSphere();
        this.initTextures().then(
            () => {
                this.earth = this.createEarth();
                this.scene.add(<THREE.Mesh>this.earth);
                this.readyToRender = true;
            });
        this.initZoomControl();
        this.initHeatmap();
        this.initRayCaster();
    }
    private static cameraFov: number = 35;
    private static cameraNear: number = 0.1;
    private static cameraFar: number = 10000;
    private static clearColor: number = 0xbac4d2;
    private static ambientLight: number = 0x000000;
    private static directionalLight: number = 0xffffff;
    private static directionalLightIntensity: number = 0.4;
    private static tileSize: number = 256;
    private static initialResolutionLevel: number = 2;
    private static maxResolutionLevel: number = 5;
    private static metadataUrl: string = `https://dev.virtualearth.net/REST/V1/Imagery/Metadata/Road?output=json&uriScheme=https&key=${Settings.BingKey}`;
    private static reserveBindMapsMetadata: BingResourceMetadata = {
        imageUrl: "https://{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=0&mkt={culture}",
        imageUrlSubdomains: [
            "t1",
            "t2",
            "t3",
            "t4",
            "t5",
            "t6",
            "t7"
        ],
        imageHeight: 256,
        imageWidth: 256
    };
    private currentLanguage: string = "en-GB";
    private static TILE_STORAGE_KEY = "GLOBEMAP_TILES_STORAGE";

    private initScene(): void {
        this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        this.rendererContainer = $("<div>").appendTo(this.root).addClass("globeMapView");

        this.rendererContainer.append(this.renderer.domElement);
        this.rendererCanvas = this.renderer.domElement;
        this.camera = new THREE.PerspectiveCamera(
            GlobeMap.cameraFov,
            this.layout.viewportIn.width / this.layout.viewportIn.height,
            GlobeMap.cameraNear,
            GlobeMap.cameraFar);
        this.orbitControls = new THREE.OrbitControls(this.camera, this.rendererCanvas);
        this.orbitControls.enablePan = false;
        this.scene = new THREE.Scene();

        this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
        this.renderer.setClearColor(GlobeMap.clearColor, 1);
        this.camera.position.z = this.GlobeSettings.cameraRadius;
        this.orbitControls.maxDistance = this.GlobeSettings.cameraRadius;
        this.orbitControls.minDistance = this.GlobeSettings.earthRadius + 1;
        this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed;
        this.orbitControls.zoomSpeed = this.GlobeSettings.zoomSpeed;
        this.orbitControls.autoRotate = this.GlobeSettings.autoRotate;

        const ambientLight: THREE.AmbientLight = new THREE.AmbientLight(GlobeMap.ambientLight);
        const light1: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);
        const light2: THREE.DirectionalLight = new THREE.DirectionalLight(GlobeMap.directionalLight, GlobeMap.directionalLightIntensity);

        this.scene.add(ambientLight);
        this.scene.add(light1);
        this.scene.add(light2);

        light1.position.set(20, 20, 20);
        light2.position.set(0, 0, -20);

        const render: FrameRequestCallback = () => {
            try {
                if (this.renderLoopEnabled) {
                    this.animationFrameId = requestAnimationFrame(render);
                }
                if (!this.shouldRender()) {
                    return;
                }
                this.orbitControls.update();
                this.setEarthTexture();
                if (this.heatmap && this.heatmap.display) {
                    this.heatmap.display(); // Needed for IE/Edge to behave nicely
                }
                this.renderer.render(this.scene, this.camera);
                this.intersectBars();
                this.needsRender = false;
            } catch (e) {
                console.error(e);
            }
        };

        this.animationFrameId = requestAnimationFrame(render);
    }

    private shouldRender(): boolean {
        return this.readyToRender && this.needsRender;
    }

    private createEarth(): THREE.Mesh {
        const geometry: MercartorSphere = new MercartorSphere(
            this.GlobeSettings.earthRadius,
            this.GlobeSettings.earthSegments,
            this.GlobeSettings.earthSegments);
        const material: THREE.MeshPhongMaterial = new THREE.MeshPhongMaterial({
            map: this.mapTextures[0],
            side: THREE.DoubleSide,
            shading: THREE.SmoothShading,
            shininess: 1
        });

        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);
        mesh.add(new THREE.AmbientLight(0xaaaaaa, 1));

        return mesh;
    }

    private static dollyX: number = 0.95;
    public zoomClicked(zoomDirection: number): void {
        if (this.orbitControls.enabled === false) {
            return;
        }

        if (zoomDirection === -1) {
            this.orbitControls.dollyOut(Math.pow(GlobeMap.dollyX, this.GlobeSettings.zoomSpeed));
        } else if (zoomDirection === 1) {
            this.orbitControls.dollyIn(Math.pow(GlobeMap.dollyX, this.GlobeSettings.zoomSpeed));
        }

        this.updateBarsAndHeatMapByZoom(-zoomDirection);
        this.orbitControls.update();
        this.animateCamera(this.camera.position);
    }

    public rotateCam(deltaX: number, deltaY: number): void {
        if (!this.orbitControls.enabled) {
            return;
        }
        this.orbitControls.rotateLeft(2 * Math.PI * deltaX / this.rendererCanvas.offsetHeight * this.GlobeSettings.rotateSpeed);
        this.orbitControls.rotateUp(2 * Math.PI * deltaY / this.rendererCanvas.offsetHeight * this.GlobeSettings.rotateSpeed);
        this.orbitControls.update();
        this.animateCamera(this.camera.position);
    }

    public static minimizeTiles(tileCacheArray: TileMap[]): ITileGapObject[] {
        if (!tileCacheArray || !tileCacheArray.length) {
            return [];
        }

        let result = [];
        tileCacheArray.forEach(obj => {
            let rank: number = 0, lastKey: number = Number(Object.keys(obj)[0]);
            let gap: number[] = [lastKey];
            let gaps = [];
            for (let key in obj) {
                if (obj.hasOwnProperty(key)) {
                    rank = key.length;
                    const convertedKey: number = Number(key);
                    if (Math.abs(convertedKey - lastKey) > 1) {
                        gap.push(lastKey);
                        gaps.push(gap);
                        gap = [convertedKey];
                    }
                    lastKey = convertedKey;
                }
            }
            gap.push(lastKey);
            gaps.push(gap);
            let currentZoomTiles: ITileGapObject = {
                gaps,
                rank
            };
            result.push(currentZoomTiles);
        });

        return result;
    }

    public static extendTiles(tileCacheData: string, language: string, deferred: JQueryDeferred<{}>) {
        let result = [];

        if (!tileCacheData || !tileCacheData.length) {
            deferred.resolve(result);
            return;
        }

        let tileCacheArray: ITileGapObject[] = JSON.parse(tileCacheData);
        if (!Array.isArray(tileCacheArray) || !tileCacheArray.length) {
            deferred.resolve(result);
            return;
        }

        GlobeMap.getBingMapsServerMetadata()
            .then((metadata: BingResourceMetadata) => {
                let urlTemplate = metadata.imageUrl.replace("{culture}", language);
                const subdomains = metadata.imageUrlSubdomains;

                tileCacheArray.forEach((zoomArray: ITileGapObject, level) => {
                    const rank: number = zoomArray.rank;
                    const gaps = zoomArray.gaps;
                    let resultForCurrentZoom = {};
                    gaps.forEach((gap: number[]) => {
                        for (let gapItem = _.first(gap); gapItem <= _.last(gap); gapItem++) {
                            let stringGap: string = gapItem.toString();
                            while (stringGap.length < rank) {
                                stringGap = `0${stringGap}`;
                            }
                            resultForCurrentZoom[stringGap] = urlTemplate.replace("{subdomain}", subdomains[level]).replace("{quadkey}", stringGap);
                        }
                    });
                    result.push(resultForCurrentZoom);
                });

                deferred.resolve(result);
            });
    }

    private loadFromBing(language: string, deferred: JQueryDeferred<{}>): JQueryPromise<void> {
        let tileCacheValue = [];
        return GlobeMap.getBingMapsServerMetadata()
            .then((metadata: BingResourceMetadata) => {

                let urlTemplate = metadata.imageUrl.replace("{culture}", language);
                for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                    let levelTiles = GlobeMap.generateQuadsByLevel(level, urlTemplate, metadata.imageUrlSubdomains);
                    tileCacheValue.push(levelTiles);
                }

                const minimizedTileCacheData: string = JSON.stringify(GlobeMap.minimizeTiles(tileCacheValue));
                this.localStorageService.set(`${GlobeMap.TILE_STORAGE_KEY}_${language}`, minimizedTileCacheData);

                deferred.resolve(tileCacheValue);
            }).fail(() => {
                deferred.resolve(tileCacheValue);
            });
    }

    private getTilesData(language: string): JQueryPromise<{}> {
        let deferred = $.Deferred();
        let tileCachePromise: IPromise<string> = this.localStorageService.get(`${GlobeMap.TILE_STORAGE_KEY}_${language}`);

        tileCachePromise.then(data => GlobeMap.extendTiles(data, this.currentLanguage, deferred))
            .catch(() => this.loadFromBing(language, deferred));

        return deferred;
    }

    private initTextures(): JQueryPromise<{}> {
        this.mapTextures = [];
        let deferred = $.Deferred();

        this.getTilesData(this.currentLanguage).then((tiles: TileMap[]) => {
            for (let level: number = GlobeMap.initialResolutionLevel; level <= GlobeMap.maxResolutionLevel; ++level) {
                this.mapTextures.push(this.createTexture(level, tiles[level - GlobeMap.initialResolutionLevel]));
            }
            deferred.resolve("success");
        });

        return deferred;
    }



    private static getBingMapsServerMetadata(): JQueryPromise<BingResourceMetadata> {
        return $.ajax(GlobeMap.metadataUrl)
            .then((data: BingMetadata) => {
                if (data.resourceSets.length) {
                    let resourceSet = data.resourceSets[0];
                    if (resourceSet && resourceSet.resources.length) {
                        return resourceSet.resources[0];
                    }
                }
                throw "Bing Maps API response was changed. Please update code for new version";
            })
            .fail((error: JQueryPromise<{}>) => {
                console.error(JSON.stringify(error));
                return GlobeMap.reserveBindMapsMetadata;
            });
    }

    /**
     * Generate Bing tile object by map level
     * @see https://msdn.microsoft.com/en-us/library/bb259689.aspx
     * @private
     * @param {number} level map lavel
     * @param {string} urlTemplate url template
     * @example https://ecn.{subdomain}.tiles.virtualearth.net/tiles/r{quadkey}.jpeg?g=5691&mkt={culture}&shading=hill
     * @param {string[]} subdomains list of subdomauns
     * @returns {{ [quadKey: string]: string }} Object <quadKey> : <image url>
     * @memberOf GlobeMap
     */
    private static generateQuadsByLevel(level: number, urlTemplate: string, subdomains: string[]): TileMap {
        const result: TileMap = {};
        let currentSubDomainNumber: number = 0;
        const generateQuard = (currentLevel: number = 0, quadKey: string = ""): void => {
            if (currentLevel < level) {
                for (let i = 0; i < GlobeMap.CountTilesPerSegment; i++) {
                    generateQuard(currentLevel + 1, `${quadKey}${i}`);
                }
            } else if (currentLevel === level) {
                result[quadKey] = urlTemplate.replace("{subdomain}", subdomains[currentSubDomainNumber]).replace("{quadkey}", quadKey);
                currentSubDomainNumber++;
                currentSubDomainNumber = currentSubDomainNumber < subdomains.length ? currentSubDomainNumber : 0;
            }
        };
        generateQuard();
        return result;
    }

    private createTexture(level: number, tiles: TileMap): THREE.Texture {
        const numSegments: number = Math.pow(2, level);
        const canvasSize: number = GlobeMap.tileSize * numSegments;
        const canvas: HTMLCanvasElement = document.createElement("canvas");
        canvas.width = canvasSize;
        canvas.height = canvasSize;
        const texture: THREE.Texture = new THREE.Texture(canvas);
        texture.needsUpdate = true;
        this.loadTiles(canvas, tiles, () => {
            texture.needsUpdate = true;
            this.needsRender = true;
        });
        return texture;
    }

    /**
     * Load tiles of Bing Maps
     * @param jCanvas jQuery convas object
     * @param tiles map of tiles
     * @param successCallback call this function when all tiles of the map are successfully loaded
     */
    private loadTiles(canvasEl: HTMLCanvasElement, tiles: TileMap, successCallback: Function): void {
        let tilesLoaded: number = 0;
        const countTiles: number = Object.keys(tiles).length;
        const canvasContext: CanvasRenderingContext2D = canvasEl.getContext("2d");
        for (let quadKey in tiles) {
            if (tiles.hasOwnProperty(quadKey)) {
                const coords: ICanvasCoordinate = this.getCoordByQuadKey(quadKey);
                const tile: HTMLImageElement = new Image();
                tile.onload = (event: Event) => {
                    tilesLoaded++;
                    canvasContext.drawImage(tile, coords.x * GlobeMap.tileSize, coords.y * GlobeMap.tileSize, GlobeMap.tileSize, GlobeMap.tileSize);
                    if (tilesLoaded === countTiles) {
                        successCallback();
                    }
                };
                // So the canvas doesn't get tainted
                tile.crossOrigin = "";
                tile.src = tiles[quadKey];
            }
        }
    }

    /**
     * Get coordinates by Bing Maps quard name
     * @private
     * @param {string} quard Bing Maps quard name
     * @returns {CanvasCoordinate} image coordinate
     * @memberOf GlobeMap
     */
    private getCoordByQuadKey(quard: string): ICanvasCoordinate {
        const last: number = quard.length - 1;
        let x: number = 0;
        let y: number = 0;

        for (let i: number = last; i >= 0; i--) {
            const chr: string = quard.charAt(i);
            const pow: number = Math.pow(2, last - i);
            switch (chr) {
                case "1": x += pow; break;
                case "2": y += pow; break;
                case "3": x += pow; y += pow; break;
            }
        }

        return { x: x, y: y };
    }

    private initHeatmap() {
        let heatmap: GlobeMapHeatMapClass;
        try {
            heatmap = this.heatmap = new WebGLHeatmap({ width: this.GlobeSettings.heatmapSize, height: this.GlobeSettings.heatmapSize, intensityToAlpha: true });
        } catch (e) {
            // IE & Edge will throw an error about texImage2D, we need to ignore it
            console.error(e);
        }

        // canvas contents will be used for a texture
        const texture: THREE.Texture = this.heatTexture = new THREE.Texture(heatmap.canvas);
        texture.needsUpdate = true;

        const material: THREE.MeshBasicMaterial = new THREE.MeshBasicMaterial({ map: texture, transparent: true });
        const geometry: THREE.SphereGeometry = new THREE.SphereGeometry(this.GlobeSettings.earthRadius + 0.01, this.GlobeSettings.earthSegments, this.GlobeSettings.earthSegments);
        const mesh: THREE.Mesh = new THREE.Mesh(geometry, material);

        window["heatmap"] = heatmap;
        window["heatmapTexture"] = texture;

        this.scene.add(mesh);
    }

    private setEarthTexture(): void {
        // get distance as arbitrary value from 0-1
        if (!this.camera) {
            return;
        }
        const maxDistance: number = this.GlobeSettings.cameraRadius - this.GlobeSettings.earthRadius;
        const distance: number = (this.camera.position.length() - this.GlobeSettings.earthRadius) / maxDistance;
        let texture: THREE.Texture = this.mapTextures[0];
        for (let divider: number = GlobeMap.initialResolutionLevel; divider <= GlobeMap.maxResolutionLevel; divider++) {
            if (distance <= divider / GlobeMap.maxResolutionLevel) {
                texture = this.mapTextures[GlobeMap.maxResolutionLevel - divider];
                break;
            }
        }

        if (this.earth.material.map !== texture) {
            this.earth.material.map = texture;
        }

        if (this.selectedBar) {
            this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed;
        } else {
            this.orbitControls.rotateSpeed = this.GlobeSettings.rotateSpeed * distance;
        }
    }

    public update(options: VisualUpdateOptions): void {
        if (options.dataViews === undefined || options.dataViews === null) {
            return;
        }
        this.layout.viewport = options.viewport;
        this.root.css(this.layout.viewportIn);
        this.controlContainer.setAttribute("style",
            `display: ${this.layout.viewportIn.height > GlobeMap.ZoomControlSettings.height
                && this.layout.viewportIn.width > GlobeMap.ZoomControlSettings.width
                ? null : "none"}`);

        if (this.layout.viewportChanged) {
            if (this.camera && this.renderer) {
                this.camera.aspect = this.layout.viewportIn.width / this.layout.viewportIn.height;
                this.camera.updateProjectionMatrix();
                this.renderer.setSize(this.layout.viewportIn.width, this.layout.viewportIn.height);
                this.renderer.render(this.scene, this.camera);
            }
        }

        if (options.type === GlobeMap.ChangeDataType || options.type === GlobeMap.ChangeAllType) {
            this.cleanHeatAndBar();
            const data: GlobeMapData = GlobeMap.converter(options.dataViews[0], this.colors, this.visualHost);
            if (data) {
                this.data = data;
                this.renderMagic();
            }
        }
    }

    public cleanHeatAndBar(): void {
        this.heatmap.clear();
        this.heatTexture.needsUpdate = true;
        if (this.barsGroup) {
            this.scene.remove(this.barsGroup);
        }
    }

    private renderMagic(): void {
        if (!this.data) {
            return;
        }
        this.data.dataPoints.forEach(d => this.geocodeRenderDatum(d)); // all coordinates (latitude/longitude) will be gained here
        this.data.dataPoints.forEach((d) => {
            return d.location = this.globeMapLocationCache[d.placeKey] || d.location;
        });
        if (!this.readyToRender) {
            this.defferedRender();
            return;
        }

        this.updateBarsAndHeatMapByZoom();

        if (this.barsGroup.children.length > 0 && this.camera && (this.initialLocationsLength !== this.barsGroup.children.length || this.barsGroup.children.length === 1)) {
            this.averageBarVector.multiplyScalar(1 / this.barsGroup.children.length);
            if (this.locationsLoaded === this.locationsToLoad) {
                this.initialLocationsLength = this.barsGroup.children.length;

                const maxDistance: number = this.GlobeSettings.cameraRadius - this.GlobeSettings.earthRadius;
                const distance: number = (this.camera.position.length() - this.GlobeSettings.earthRadius) / maxDistance;

                let angleRate: number = 12;

                if (distance < 0.5) {
                    angleRate = 36;
                } else if (distance < 0.25) {
                    angleRate = 60;
                } else if (distance < 0.15) {
                    angleRate = 0;
                }

                if (angleRate > 0) {
                    const axisY = new THREE.Vector3(0, 1, 0);
                    const axisZ = new THREE.Vector3(0, 0, 1);
                    const angle = Math.PI / angleRate;
                    this.averageBarVector.applyAxisAngle(axisY, angle);
                    this.averageBarVector.applyAxisAngle(axisZ, angle);
                }

                this.isFirstLoad ? this.setCameraPosition(this.averageBarVector) : this.animateCamera(this.averageBarVector);
            }
        }

        this.heatmap.blur();
        this.heatTexture.needsUpdate = true;
        this.needsRender = true;

        if (this.isFirstLoad === true) {
            this.isFirstLoad = false;
        }
    }

    private getBarMaterialByIndex(index: number): THREE.MeshPhongMaterial {
        return new THREE.MeshPhongMaterial({ color: this.data.seriesDataPoints[index] ? this.data.seriesDataPoints[index].color : this.data.seriesDataPoints[0].color });
    }

    private getToolTipDataForSeries(toolTipData, dataPointToolTip): {} {
        const result: { height } = $.extend(true, {
            series: { displayName: dataPointToolTip.displayName, value: dataPointToolTip.value }
        }, toolTipData);
        result.height.value = dataPointToolTip.dataPointValue;
        return result;
    }

    private geocodeRenderDatum(renderDatum: GlobeMapDataPoint) {
        // zero valued locations should be updated
        if ((renderDatum.location && renderDatum.location.longitude !== 0 && renderDatum.location.latitude !== 0) || this.globeMapLocationCache[renderDatum.placeKey]) {
            return;
        }

        const location: ILocation = { latitude: null, longitude: null };
        let geocoder: IGeocoder;
        this.globeMapLocationCache[renderDatum.placeKey] = location; // store empty object so we don't send AJAX request again
        this.locationsToLoad++;

        geocoder = createGeocoder(this.localStorageService);
        if (geocoder) {
            (geocoder.geocode(
                renderDatum.place,
                renderDatum.locationType) as ExtendedPromise<IGeocodeCoordinate>).always((l: ILocation) => {
                    // we use always because we want to cache unknown values.
                    // No point asking bing again and again when it tells us it doesn't know about a location
                    if (l) {
                        location.latitude = l.latitude;
                        location.longitude = l.longitude;
                    }

                    this.locationsLoaded++;

                    this.defferedRender();
                });
        }
    }

    private defferedRender() {
        if (!this.deferredRenderTimerId) {
            // tslint:disable-next-line
            this.deferredRenderTimerId = <any>setTimeout(() => {
                this.deferredRenderTimerId = null;
                this.renderMagic();
            }, 500);
        }
    }

    private initRayCaster() {
        this.rayCaster = new THREE.Raycaster();

        const element: HTMLElement = this.root.get(0);
        let mouseDownTime: number;
        const elementStyle: CSSStyleDeclaration = window.getComputedStyle(element);

        $(this.rendererCanvas).on("mousemove", (event: JQueryEventObject) => {
            const elementViewHeight: number = element.offsetHeight - element.offsetTop
                - parseFloat(elementStyle.paddingTop)
                - parseFloat(elementStyle.paddingBottom);

            const elementViewWidth: number = element.offsetWidth - element.offsetLeft
                - parseFloat(elementStyle.paddingLeft)
                - parseFloat(elementStyle.paddingRight);

            const fractionalPositionX: number = event.offsetX / elementViewWidth;
            const fractionalPositionY: number = event.offsetY / elementViewHeight;

            this.mousePos = new THREE.Vector2(event.clientX, event.clientY);

            // get coordinates in -1 to +1 space
            this.mousePosNormalized = new THREE.Vector2(fractionalPositionX * 2 - 1, -fractionalPositionY * 2 + 1);

            this.needsRender = true;
        }).on("mousedown", (event: JQueryEventObject) => {
            cancelAnimationFrame(this.cameraAnimationFrameId);
            mouseDownTime = Date.now();
        }).on("mouseup", (event: JQueryEventObject) => {

            // Debounce slow clicks
            if ((Date.now() - mouseDownTime) > this.GlobeSettings.clickInterval) {
                return;
            }

            if (this.hoveredBar && event.shiftKey) {
                this.selectedBar = this.hoveredBar;
                this.animateCamera(this.selectedBar.position, () => {
                    if (!this.selectedBar) return;
                    this.orbitControls.target.copy(this.selectedBar.position.clone().normalize().multiplyScalar(this.GlobeSettings.earthRadius));
                    this.orbitControls.minDistance = 1;
                });
            } else {
                if (this.selectedBar) {
                    this.animateCamera(this.selectedBar.position, () => {
                        this.orbitControls.target.set(0, 0, 0);
                        this.orbitControls.minDistance = this.GlobeSettings.earthRadius + 1;
                    });
                    this.selectedBar = null;
                }
            }
        }).on("mousewheel DOMMouseScroll", (e: { originalEvent }) => {
            this.needsRender = true;
            if (this.orbitControls.enabled && this.orbitControls.enableZoom) {
                cancelAnimationFrame(this.cameraAnimationFrameId);
                this.heatTexture.needsUpdate = true;
                let event: { wheelDelta, detail } = e.originalEvent;
                const delta: number = event.wheelDelta > 0 || event.detail < 0 ? 1 : -1;
                this.updateBarsAndHeatMapByZoom(delta);
            }
        });
    }

    private intersectBars() {
        if (!this.rayCaster
            || !this.barsGroup
            || !this.mousePosNormalized
            || !this.mousePos) {

            return;
        }

        const rayCaster: THREE.Raycaster = this.rayCaster;

        rayCaster.setFromCamera(this.mousePosNormalized, this.camera);
        const intersects: THREE.Intersection[] = rayCaster.intersectObjects(this.barsGroup.children);

        if (intersects && intersects.length > 0) {
            const object: IGlobeMapObject3DWithToolTipData = <IGlobeMapObject3DWithToolTipData>intersects[0].object;

            if (!object || !(object).toolTipData) {
                return;
            }

            const toolTipData: { location, longitude, latitude, series, height, heat } = (object).toolTipData;
            const toolTipItems: VisualTooltipDataItem[] = [];

            if (toolTipData.location.displayName) {
                toolTipItems.push(toolTipData.location);
            }

            if (toolTipData.longitude.displayName) {
                toolTipItems.push(toolTipData.longitude);
            }

            if (toolTipData.latitude.displayName) {
                toolTipItems.push(toolTipData.latitude);
            }

            if (toolTipData.series) {
                toolTipItems.push(toolTipData.series);
            }

            if (toolTipData.height.displayName) {
                toolTipItems.push(toolTipData.height);
            }

            if (toolTipData.heat.displayName) {
                toolTipItems.push(toolTipData.heat);
            }

            this.hoveredBar = object;

            const tooltipShowOptions: TooltipShowOptions = {
                coordinates: [
                    this.mousePos.x,
                    this.mousePos.y
                ],
                isTouchEvent: false,
                dataItems: toolTipItems,
                identities: []
            };

            this.visualHost.tooltipService.show(tooltipShowOptions);
        } else {
            this.hoveredBar = null;
            this.hideTooltip();
        }
    }

    private hideTooltip(): void {
        const tooltipHideOptions: TooltipHideOptions = {
            immediately: true,
            isTouchEvent: false
        };

        this.tooltipService.hide(tooltipHideOptions);
    }

    private setCameraPosition(to: THREE.Vector3) {
        this.hideTooltip();

        if (!this.camera) {
            return;
        }

        const endPos: THREE.Vector3 = to.clone().normalize();
        const length: number = this.camera.position.length();
        const pos: THREE.Vector3 = new THREE.Vector3()
            .add(endPos.clone().multiplyScalar(2))
            .normalize()
            .multiplyScalar(length);

        this.camera.position.set(pos.x, pos.y, pos.z);
    }

    private animateCamera(to: THREE.Vector3, done?: Function) {
        this.hideTooltip();

        if (!this.camera) {
            return;
        }

        cancelAnimationFrame(this.cameraAnimationFrameId);
        const startTime: number = Date.now();
        const duration: number = this.GlobeSettings.cameraAnimDuration;
        const endTime: number = startTime + duration;
        const startPos: THREE.Vector3 = this.camera.position.clone().normalize();
        const endPos: THREE.Vector3 = to.clone().normalize();
        const length: number = this.camera.position.length();
        const alpha: number = 2;
        const beta: number = 1.9;
        const easeInOutQuint = (t) => {
            if (t < alpha) {
                return beta * t * t * t * t * t;
            }
            return 1 + beta * (--t) * t * t * t * t;
        };

        const onUpdate: FrameRequestCallback = () => {
            const now: number = Date.now();
            let t: number = (now - startTime) / duration;
            if (t > alpha) {
                t = alpha;
            }
            t = easeInOutQuint(t);

            const pos: THREE.Vector3 = new THREE.Vector3()
                .add(startPos.clone().multiplyScalar(alpha - t))
                .add(endPos.clone().multiplyScalar(t))
                .normalize()
                .multiplyScalar(length);

            this.camera.position.set(pos.x, pos.y, pos.z);

            if (now < endTime) {
                this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
            } else if (done) {
                done();
            }

            this.needsRender = true;
        };

        this.cameraAnimationFrameId = requestAnimationFrame(onUpdate);
    }

    public destroy() {
        cancelAnimationFrame(this.animationFrameId);
        cancelAnimationFrame(this.cameraAnimationFrameId);
        clearTimeout(this.deferredRenderTimerId);
        this.renderLoopEnabled = false;
        this.scene = null;
        this.heatmap = null;
        this.heatTexture = null;
        this.camera = null;
        if (this.renderer) {
            if (this.renderer.context) {
                const extension: { loseContext } = this.renderer.context.getExtension("WEBGL_lose_context");
                if (extension) {
                    extension.loseContext();
                }
                this.renderer.context = null;
            }
            this.renderer.domElement = null;
        }
        this.renderer = null;
        this.data = null;
        this.barsGroup = null;
        if (this.orbitControls) {
            this.orbitControls.dispose();
        }

        this.orbitControls = null;
        if (this.rendererCanvas) {
            $(this.rendererCanvas)
                .off("mousemove mouseup mousedown mousewheel DOMMouseScroll");
        }

        this.rendererCanvas = null;

        if (this.root) {
            this.root.empty();
        }

        this.hideTooltip();
    }
    private static ZoomControlSettings = {
        height: 145,
        width: 145,
        markup: `
            <svg width="145" height="145" class="controls">
                <g class="control js-control--move-up">
                    <circle cx="85" cy="20" r="17" />
                    <path d="M85 8 l12 20 a40,70 0 0,0 -24,0z" />
                </g>
                <g class="control js-control--move-right">
                    <circle cx="119" cy="54" r="17" class="zoomControlCircle" />
                    <path d="M130.9 54 l-20 -12 a70,40 0 0,1 0,24z" class="zoomControlPath" />
                </g>
                <g class="control js-control--move-down">
                    <circle cx="85" cy="88" r="17" />
                    <path d="M 85 100 l12 -20 a40,70 0 0,1 -24,0z" />
                </g>
                <g class="control js-control--move-left">
                    <circle cx="51" cy="54" r="17" />
                    <path d="M39 54 l20 -12 a70,40 0 0,0 0,24z" />
                </g>
                <g class="control js-control--zoom-down">
                    <circle cx="51" cy="122" r="17" />
                    <rect x="42" y="120" width="17" height="6" class="zoomControlPath" />
                </g>
                <g class="control js-control--zoom-up">
                    <circle cx="119" cy="122" r="17" />
                    <rect x="110.5" y="120" width="17" height="6" />
                    <rect x="116" y="114" width="6" height="17" />
                </g>
            </svg>
            `,
        zoomStep: 1,
        angleOfRotation: 5
    };
    private initZoomControl() {
        this.controlContainer = document.createElement("div");
        this.controlContainer.className = "controls-container";
        this.controlContainer.appendChild(this.createControlElements());
        this.root.append(this.controlContainer);
        let allG = this.controlContainer.querySelectorAll("g");

        for (let i = 0; i < allG.length; ++i) {
            allG[i].onmousedown = (event) => {
                event.stopPropagation();
                if (event.button === 0) {
                    const controlType = (<{ className }>(event.currentTarget as HTMLHtmlElement)).className.baseVal.toString().split(" ").filter(className => className.search("js-") !== -1)[0];
                    switch (controlType) {
                        case "js-control--move-up": this.rotateCam(0, GlobeMap.ZoomControlSettings.angleOfRotation); break;
                        case "js-control--move-down": this.rotateCam(0, -GlobeMap.ZoomControlSettings.angleOfRotation); break;
                        case "js-control--move-left": this.rotateCam(GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                        case "js-control--move-right": this.rotateCam(-GlobeMap.ZoomControlSettings.angleOfRotation, 0); break;
                        case "js-control--zoom-up": this.zoomClicked(-GlobeMap.ZoomControlSettings.zoomStep); break;
                        case "js-control--zoom-down": this.zoomClicked(GlobeMap.ZoomControlSettings.zoomStep); break;
                    }
                }
            };
        }
    }
    private initMercartorSphere() {
        if (GlobeMap.MercartorSphere) return;

        let ms = new MercartorSphere(
            this.GlobeSettings.earthRadius,
            this.GlobeSettings.earthSegments,
            this.GlobeSettings.earthSegments);
        ms.prototype = Object.create(THREE.Geometry.prototype);

        GlobeMap.MercartorSphere = ms;
    }

    private updateBarsAndHeatMapByZoom(delta: number = 0): void {
        if (!this.data) {
            return;
        }
        // delta > 0 ? Zoom increased
        // delta < 0 ? Zoom decreased
        let heatSizeScale: number = delta > 0 ? this.GlobeSettings.heatmapScaleOnZoom : (1 / this.GlobeSettings.heatmapScaleOnZoom);
        let barHeightScale: number = delta > 0 ? this.GlobeSettings.barHeightScaleOnZoom : (1 / this.GlobeSettings.barHeightScaleOnZoom);
        let barWidthtScale: number = delta > 0 ? this.GlobeSettings.barWidthScaleOnZoom : (1 / this.GlobeSettings.barWidthScaleOnZoom);

        if (delta === 0) {
            heatSizeScale = 1;
            barHeightScale = 1;
            barWidthtScale = 1;
        }

        // Calculate new bar and heat sizes by zool level
        this.GlobeSettings.heatPointSize = this.calculateNewSizeOfShape(this.GlobeSettings.heatPointSize, heatSizeScale, this.GlobeSettings.minHeatPointSize, this.GlobeSettings.maxHeatPointSize);
        this.GlobeSettings.heatIntensity = this.calculateNewSizeOfShape(this.GlobeSettings.heatIntensity, heatSizeScale, this.GlobeSettings.minHeatIntensity, this.GlobeSettings.maxHeatIntensity);
        this.GlobeSettings.barHeight = this.calculateNewSizeOfShape(this.GlobeSettings.barHeight, barHeightScale, this.GlobeSettings.minBarHeight, this.GlobeSettings.maxBarHeight);
        this.GlobeSettings.barWidth = this.calculateNewSizeOfShape(this.GlobeSettings.barWidth, barWidthtScale, this.GlobeSettings.minBarWidth, this.GlobeSettings.maxBarWidth);

        this.cleanHeatAndBar();
        this.barsGroup = new THREE.Object3D();
        this.scene.add(this.barsGroup);
        this.averageBarVector = new THREE.Vector3();
        const len: number = this.data.dataPoints.length;
        for (let i: number = 0; i < len; ++i) {
            const renderDatum: GlobeMapDataPoint = this.data.dataPoints[i];

            if (!renderDatum.location || renderDatum.location.longitude === undefined || renderDatum.location.latitude === undefined
                || (renderDatum.location.longitude === 0 && renderDatum.location.latitude === 0)
            ) {
                continue;
            }

            if (renderDatum.heat > 0.001) {
                if (renderDatum.heat < 0.1) renderDatum.heat = 0.1;
                const x: number = (180 + renderDatum.location.longitude) / 360 * this.GlobeSettings.heatmapSize;
                const y: number = (1 - ((90 + renderDatum.location.latitude) / 180)) * this.GlobeSettings.heatmapSize;

                this.heatmap.addPoint(x, y, this.GlobeSettings.heatPointSize, renderDatum.heat * this.GlobeSettings.heatIntensity);
            }

            if (renderDatum.height >= 0) {
                if (renderDatum.height < 0.01) renderDatum.height = 0.01;
                const latRadians: number = renderDatum.location.latitude / 180 * Math.PI; // radians
                const lngRadians: number = renderDatum.location.longitude / 180 * Math.PI;

                const x: number = Math.cos(lngRadians) * Math.cos(latRadians);
                const z: number = -Math.sin(lngRadians) * Math.cos(latRadians);
                const y: number = Math.sin(latRadians);
                const vector: THREE.Vector3 = new THREE.Vector3(x, y, z);

                this.averageBarVector.add(vector);

                const barHeight: number = this.GlobeSettings.barHeight * renderDatum.height;
                // this array holds the relative series values to the actual measure for example [0.2,0.3,0.5]
                // this is how we draw the vectors relativly to the complete value one on top of another.
                const measuresBySeries: number[] = [];
                // this array holds the original values of the series for the tool tips
                const dataPointToolTip: string[] = [];
                if (renderDatum.heightBySeries) {
                    for (let c: number = 0; c < renderDatum.heightBySeries.length; c++) {
                        if (renderDatum.heightBySeries[c] || renderDatum.heightBySeries[c] === 0) {
                            measuresBySeries.push(renderDatum.heightBySeries[c]);
                        }
                        dataPointToolTip.push(renderDatum.seriesToolTipData && renderDatum.seriesToolTipData[c] ? renderDatum.seriesToolTipData[c] : "");
                    }
                } else {
                    // no category series so we'll just draw one value
                    measuresBySeries.push(1);
                }

                let previousMeasureValue = 0;
                for (let j: number = 0; j < measuresBySeries.length; j++) {
                    previousMeasureValue += measuresBySeries[j];
                    const geometry: THREE.BoxGeometry = new THREE.BoxGeometry(this.GlobeSettings.barWidth, this.GlobeSettings.barWidth, barHeight * measuresBySeries[j]);
                    const bar: THREE.Mesh & { toolTipData } = <THREE.Mesh & { toolTipData }>new THREE.Mesh(geometry, this.getBarMaterialByIndex(i));
                    const position: THREE.Vector3 = vector.clone().multiplyScalar(this.GlobeSettings.earthRadius + ((barHeight / 2) * previousMeasureValue));
                    bar.position.set(position.x, position.y, position.z);
                    bar.lookAt(vector);
                    bar.toolTipData = dataPointToolTip.length === 0
                        ? renderDatum.toolTipData
                        : this.getToolTipDataForSeries(renderDatum.toolTipData, dataPointToolTip[j]);

                    this.barsGroup.add(bar);

                    previousMeasureValue += measuresBySeries[j];
                }
            }
        }

        this.heatmap.update();
    }

    private calculateNewSizeOfShape(size: number, scale: number, minSize: number, maxSize: number): number {
        size *= scale;
        if (size > maxSize) {
            size = maxSize;
        } else if (size < minSize) {
            size = minSize;
        }

        return size;
    }

    private createControlElements(): Element {
        const protocol: string = "http";
        let svgNS: string = `${protocol}://www.w3.org/2000/svg`;

        const circle = (cx: number, cy: number, r: number, classNames?: string) => {
            let c = document.createElementNS(svgNS, "circle");
            c.setAttribute("cx", cx.toString());
            c.setAttribute("cy", cy.toString());
            c.setAttribute("r", r.toString());
            if (classNames) {
                (<{ className }>c).className.baseVal = classNames;
            }
            return c;
        };

        const path = (d: string, classNames?: string) => {
            let p = document.createElementNS(svgNS, "path");
            p.setAttribute("d", d);
            if (classNames) {
                (<{ className }>p).className.baseVal = classNames;
            }
            return p;
        };

        const rect = (x: number, y: number, width: number, height: number, classNames?: string) => {
            let r = document.createElementNS(svgNS, "rect");
            r.setAttribute("x", x.toString());
            r.setAttribute("y", y.toString());
            r.setAttribute("width", width.toString());
            r.setAttribute("height", height.toString());
            if (classNames) {
                (<{ className }>r).className.baseVal = classNames;
            }
            return r;
        };

        const g = (classNames: string) => {
            let g = document.createElementNS(svgNS, "g");
            if (classNames) {
                (<{ className }>g).className.baseVal = classNames;
            }
            return g;
        };

        let moveUpButton = g("control js-control--move-up");
        moveUpButton.appendChild(circle(85, 20, 17));
        moveUpButton.appendChild(path("M85 8 l12 20 a40,70 0 0,0 -24,0z"));

        let moveRightButton = g("control js-control--move-right");
        moveRightButton.appendChild(circle(119, 54, 17, "zoomControlCircle"));
        moveRightButton.appendChild(path("M130.9 54 l-20 -12 a70,40 0 0,1 0,24z", "zoomControlPath"));

        let moveDownButton = g("control js-control--move-down");
        moveDownButton.appendChild(circle(85, 88, 17));
        moveDownButton.appendChild(path("M 85 100 l12 -20 a40,70 0 0,1 -24,0z"));

        let moveLeftButton = g("control js-control--move-left");
        moveLeftButton.appendChild(circle(51, 54, 17));
        moveLeftButton.appendChild(path("M39 54 l20 -12 a70,40 0 0,0 0,24z"));

        let zoomDownButton = g("control js-control--zoom-down");
        zoomDownButton.appendChild(circle(51, 122, 17));
        zoomDownButton.appendChild(rect(42, 120, 17, 6, "zoomControlPath"));

        let zoomUpButton = g("control js-control--zoom-up");
        zoomUpButton.appendChild(circle(119, 122, 17));
        zoomUpButton.appendChild(rect(110.5, 120, 17, 6));
        zoomUpButton.appendChild(rect(116, 114, 6, 17));

        let controlsContainerSVG = document.createElementNS(svgNS, "svg");
        (<{ className }>controlsContainerSVG).className.baseVal = "controls";
        controlsContainerSVG.setAttribute("width", "145");
        controlsContainerSVG.setAttribute("height", "145");

        controlsContainerSVG.appendChild(moveUpButton);
        controlsContainerSVG.appendChild(moveRightButton);
        controlsContainerSVG.appendChild(moveDownButton);
        controlsContainerSVG.appendChild(moveLeftButton);
        controlsContainerSVG.appendChild(zoomDownButton);
        controlsContainerSVG.appendChild(zoomUpButton);

        return controlsContainerSVG;
    }

    public static getCategoricalValueByIndex(category: DataViewCategoryColumn | DataViewValueColumn, index: number): string {
        if (!category ||
            !Array.isArray(category.values) ||
            category.values.length <= index) {
            return "";
        }
        return `${category.values[index]}`;
    }
}
