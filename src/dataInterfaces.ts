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

import powerbi from "powerbi-visuals-api";

import DataView = powerbi.DataView;
import PrimitiveValue = powerbi.PrimitiveValue;
import ValueTypeDescriptor = powerbi.ValueTypeDescriptor;

import { interactivitySelectionService } from "powerbi-visuals-utils-interactivityutils";
import SelectableDataPoint = interactivitySelectionService.SelectableDataPoint;

import { ILocation } from "./geocoder/geocoder";
import { GlobeMapSettings } from "./settings";

export interface GlobeMapData {
    dataView: DataView;
    settings: GlobeMapSettings;
    dataPoints: GlobeMapDataPoint[];
    seriesDataPoints: GlobeMapSeriesDataPoint[];
}

export interface GlobeMapDataPoint {
    location: ILocation;
    place: string;
    locationType: string;
    placeKey: string;
    height: number;
    heightBySeries: number[];
    seriesToolTipData: {};
    heat: number;
    toolTipData: {};
}

export interface GlobeMapSeriesDataPoint extends SelectableDataPoint {
    label: string;
    color: string;
    category?: string;
}

export interface BingMetadata {
    resourceSets: ResourceSet[];
    statusCode: string;
    statusDescription: string;
}

export interface ResourceSet {
    resources: BingResourceMetadata[];
}

export interface BingResourceMetadata {
    imageHeight: number;
    imageWidth: number;
    imageUrl: string;
    imageUrlSubdomains: string[];
}

export interface TileMap {
    [quadKey: string]: string;
}

export interface ICanvasCoordinate {
    x: number;
    y: number;
}

export interface IGlobeMapValueTypeDescriptor extends ValueTypeDescriptor {
    category: string;
}

export interface IGlobeMapToolTipData {
    location: PrimitiveValue;
    longitude: PrimitiveValue;
    latitude: PrimitiveValue;
    series: PrimitiveValue;
    height: PrimitiveValue;
    heat: PrimitiveValue;
}

export interface IGlobeMapObject3DWithToolTipData extends THREE.Object3D {
    toolTipData: IGlobeMapToolTipData;
}

export interface ITileGapObject {
    gaps: number[][];
    rank: number;
}
