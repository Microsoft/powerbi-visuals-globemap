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

export interface IGeocoder {
    geocode(query: string, category?: string, options?: GeocodeOptions): IPromise<IGeocodeCoordinate> | JQueryDeferred<IGeocodeCoordinate>;
    geocodeBoundary(latitude: number, longitude: number, category: string, levelOfDetail?: number, maxGeoData?: number, options?: GeocodeOptions): IPromise<IGeocodeBoundaryCoordinate> | JQueryDeferred<IGeocodeCoordinate>;
    geocodePoint(latitude: number, longitude: number, entities: string[], options?: GeocodeOptions): IPromise<IGeocodeCoordinate | IGeocodeResource> | JQueryDeferred<IGeocodeCoordinate>;

    /** returns data immediately if it is locally available (e.g. in cache), null if not in cache */
    tryGeocodeImmediate(query: string, category?: string): IPromise<IGeocodeCoordinate> | JQueryDeferred<IGeocodeCoordinate>;
    tryGeocodeBoundaryImmediate(latitude: number, longitude: number, category: string, levelOfDetail?: number, maxGeoData?: number): IPromise<IGeocodeBoundaryCoordinate> | JQueryDeferred<IGeocodeBoundaryCoordinate>;
}

export interface IGeocodeCoordinate {
    latitude: number;
    longitude: number;
}

export interface IGeocodeBoundaryCoordinate extends IGeocodeCoordinate {
    locations?: IGeocodeBoundaryPolygon[]; // one location can have multiple boundary polygons
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