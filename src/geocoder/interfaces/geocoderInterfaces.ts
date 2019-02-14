import powerbi from "powerbi-visuals-api";

import IPromise = powerbi.IPromise;

/** Defines geocoding services. */
export interface GeocodeOptions {
    /** promise that should abort the request when resolved */
    timeout?: IPromise<number>;
}

export interface IRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface IGeocoderOptions {
    query: string;
    category?: string;
    options?: GeocodeOptions;
}

export interface IGeocoder {
    geocodeByDataFlow(queries: string[]): Promise<ILocationDictionary>;
}

export interface IGeocodeCoordinate {
    latitude: number;
    longitude: number;
}

export interface ILocationDictionary {
    [i: string]: IGeocodeCoordinate;
}

export interface IGeocodeBoundaryCoordinate extends IGeocodeCoordinate {
    locations?: IGeocodeBoundaryPolygon[]; // one location can have multiple boundary polygons
}

export interface ILocationCoordinateRecord {
    key: string;
    coordinate: IGeocodeCoordinate | IGeocodeBoundaryCoordinate;
}

export interface IGeocodeResult {
    error?: Error;
    coordinates?: IGeocodeCoordinate | IGeocodeBoundaryCoordinate;
}

export interface IGeocodeQuery {
    getKey(): string;
    getUrl(): string;
    getResult(data: {}): IGeocodeResult;
}

export interface IGeocodeQueueItem {
    query: IGeocodeQuery;
    deferred: JQueryDeferred<{}>;
}

export interface IGeocodeResource extends IGeocodeCoordinate {
    addressLine: string;
    locality: string;
    neighborhood: string;
    adminDistrict: string;
    adminDistrict2: string;
    formattedAddress: string;
    postalCode: string;
    countryRegionIso2: string;
    countryRegion: string;
    landmark: string;
    name: string;
}

export interface IGeocodeBoundaryPolygon {
    nativeBing: string;

    /** array of lat/long pairs as [lat1, long1, lat2, long2,...] */
    geographic?: Float64Array;

    /** array of absolute pixel position pairs [x1,y1,x2,y2,...]. It can be used by the client for cache the data. */
    absolute?: Float64Array;
    absoluteBounds?: IRect;

    /** string of absolute pixel position pairs "x1 y1 x2 y2...". It can be used by the client for cache the data. */
    absoluteString?: string;
}
